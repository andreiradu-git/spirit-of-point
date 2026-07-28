import { createClient } from "@supabase/supabase-js";
import { readServerEnv } from "@/lib/server-env";
import { deleteR2ObjectDirect, listR2ObjectsDirect, optimizedKeyFor, type R2Object } from "@/lib/r2.server";

const R2_PUBLIC_URL = "https://images.pointstudio.ro";
const R2_BUCKET = "pointstudio-assets";

export type SiteAsset = {
  id?: string;
  kind: "image" | "video" | "link" | "file";
  url: string;
  source: string;
  alt?: string | null;
  name?: string;
  size?: number;
  contentType?: string;
  lastModified?: string;
  storageProvider?: "r2" | "external" | "lovable_asset";
  bucket?: string;
  objectKey?: string;
  r2Key?: string;
  usedOnSite: boolean;
  optimizedKey?: string;
  optimizedUrl?: string;
  optimizedSize?: number;
  optimizedLastModified?: string;
  isOrphanOptimized?: boolean;
};

type Db = ReturnType<typeof createClient>;
type UnsafeDb = ReturnType<typeof createClient> & { from: (table: string) => any };

function dbFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

export function getMediaDbClient(service = false): Db {
  const url = readServerEnv("SUPABASE_URL") ?? readServerEnv("VITE_SUPABASE_URL");
  const key = service
    ? readServerEnv("SUPABASE_SERVICE_ROLE_KEY")
    : readServerEnv("SUPABASE_PUBLISHABLE_KEY") ?? readServerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) throw new Error("Media database is not configured in this runtime.");
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { fetch: dbFetch(key) },
  });
}

function unsafeDb(service = false): UnsafeDb {
  return getMediaDbClient(service) as UnsafeDb;
}

function kindFromUrl(url: string): SiteAsset["kind"] {
  const lower = url.toLowerCase();
  if (/\.(mp4|webm|mov|m4v)(\?.*)?$/.test(lower)) return "video";
  if (/\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)(\?.*)?$/.test(lower)) return "image";
  return /^https?:\/\//.test(url) ? "link" : "file";
}

function contentTypeFromUrl(url: string): string | undefined {
  const lower = url.toLowerCase();
  if (/\.webp(\?|$)/.test(lower)) return "image/webp";
  if (/\.png(\?|$)/.test(lower)) return "image/png";
  if (/\.gif(\?|$)/.test(lower)) return "image/gif";
  if (/\.svg(\?|$)/.test(lower)) return "image/svg+xml";
  if (/\.mp4(\?|$)/.test(lower)) return "video/mp4";
  if (/\.webm(\?|$)/.test(lower)) return "video/webm";
  if (/\.(jpe?g)(\?|$)/.test(lower)) return "image/jpeg";
  return undefined;
}

function filenameFromUrl(url: string): string {
  const clean = url.split("?")[0] ?? url;
  try {
    const parsed = clean.startsWith("http") ? new URL(clean).pathname : clean;
    return decodeURIComponent(parsed.split("/").filter(Boolean).pop() ?? "media");
  } catch {
    return clean.split("/").filter(Boolean).pop() ?? "media";
  }
}

function rowToAsset(row: Record<string, unknown>): SiteAsset {
  const kind = (row.kind as SiteAsset["kind"]) ?? kindFromUrl(String(row.url));
  const optimizedUrl = typeof row.optimized_url === "string" ? row.optimized_url : undefined;
  const url = kind === "image" && optimizedUrl ? optimizedUrl : String(row.url);
  const storageProvider = row.storage_provider as SiteAsset["storageProvider"];
  const objectKey = typeof row.object_key === "string" ? row.object_key : undefined;
  return {
    id: row.id as string | undefined,
    kind,
    url,
    source: storageProvider === "r2" ? "Cloudflare R2" : storageProvider === "lovable_asset" ? "Legacy Lovable asset" : "Legacy external media",
    alt: (row.alt as string | null | undefined) ?? null,
    name: (row.filename as string | undefined) ?? filenameFromUrl(url),
    size: typeof row.size === "number" ? row.size : undefined,
    contentType: (row.content_type as string | undefined) ?? contentTypeFromUrl(url),
    lastModified: row.updated_at as string | undefined,
    storageProvider,
    bucket: row.bucket as string | undefined,
    objectKey,
    r2Key: storageProvider === "r2" ? objectKey : undefined,
    optimizedKey: row.optimized_object_key as string | undefined,
    optimizedUrl,
    usedOnSite: Boolean(row.used_on_site),
  };
}

function r2Row(object: R2Object, optimized?: R2Object): Record<string, unknown> {
  return {
    storage_provider: "r2",
    bucket: R2_BUCKET,
    object_key: object.key,
    filename: object.originalName || object.key.split("/").pop() || object.key,
    url: object.url,
    kind: kindFromUrl(object.url),
    content_type: object.contentType ?? contentTypeFromUrl(object.url),
    size: object.size,
    optimized_object_key: optimized?.key ?? null,
    optimized_url: optimized?.url ?? null,
  };
}

export async function syncR2MediaAssetsDirect(): Promise<void> {
  const objects = await listR2ObjectsDirect();
  const byKey = new Map(objects.map((object) => [object.key, object]));
  const rows: Record<string, unknown>[] = [];
  for (const object of objects) {
    if (object.key.startsWith("optimized/")) continue;
    rows.push(r2Row(object, byKey.get(optimizedKeyFor(object.key))));
  }
  for (const object of objects) {
    if (!object.key.startsWith("optimized/")) continue;
    const paired = rows.some((row) => row.optimized_object_key === object.key);
    if (!paired) rows.push(r2Row(object));
  }
  if (!rows.length) return;
  const db = unsafeDb(true);
  const { error } = await db.from("media_assets").upsert(rows, { onConflict: "url" });
  if (error) throw new Error(error.message);
}

export async function listAllAssetsDirect(): Promise<SiteAsset[]> {
  try {
    await syncR2MediaAssetsDirect();
  } catch (error) {
    console.warn("Media R2 sync skipped", error);
  }
  const db = unsafeDb(false);
  const { data, error } = await db
    .from("media_assets")
    .select("id, storage_provider, bucket, object_key, filename, url, kind, content_type, size, optimized_object_key, optimized_url, alt, used_on_site, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map(rowToAsset);
}

export async function upsertMediaAssetDirect(input: {
  key: string;
  url: string;
  filename: string;
  kind: SiteAsset["kind"];
  contentType?: string;
  size?: number;
}): Promise<void> {
  const db = unsafeDb(true);
  const { error } = await db.from("media_assets").upsert(
    {
      storage_provider: "r2",
      bucket: R2_BUCKET,
      object_key: input.key,
      filename: input.filename,
      url: input.url,
      kind: input.kind,
      content_type: input.contentType,
      size: input.size,
    },
    { onConflict: "url" },
  );
  if (error) throw new Error(error.message);
}

export async function markOptimizedMediaAssetDirect(key: string, url: string, size?: number): Promise<void> {
  const db = unsafeDb(true);
  const { data, error } = await db.from("media_assets").select("id, object_key").eq("storage_provider", "r2").eq("kind", "image");
  if (error) throw new Error(error.message);
  const match = ((data ?? []) as Array<{ id: string; object_key: string }>).find((row) => optimizedKeyFor(row.object_key) === key);
  if (match) {
    const { error: updateError } = await db
      .from("media_assets")
      .update({ optimized_object_key: key, optimized_url: url, updated_at: new Date().toISOString() })
      .eq("id", match.id);
    if (updateError) throw new Error(updateError.message);
    return;
  }
  await upsertMediaAssetDirect({ key, url, filename: key.split("/").pop() ?? key, kind: "image", contentType: "image/webp", size });
}

export async function deleteMediaAssetDirect(input: { id?: string; key?: string; url?: string }): Promise<void> {
  const db = unsafeDb(true);
  let query = db.from("media_assets").select("*").limit(1);
  if (input.id) query = query.eq("id", input.id);
  else if (input.key) query = query.or(`object_key.eq.${input.key},optimized_object_key.eq.${input.key}`);
  else if (input.url) query = query.or(`url.eq.${input.url},optimized_url.eq.${input.url}`);
  else throw new Error("Missing media asset id, key, or url");
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown> | null;
  if (!row) {
    if (input.key) await deleteR2ObjectDirect(input.key);
    return;
  }

  if (input.key && row.optimized_object_key === input.key && row.object_key !== input.key) {
    await deleteR2ObjectDirect(input.key);
    const { error: updateError } = await db
      .from("media_assets")
      .update({ optimized_object_key: null, optimized_url: null })
      .eq("id", row.id as string);
    if (updateError) throw new Error(updateError.message);
    return;
  }

  if (row.storage_provider === "r2") {
    const keys = [row.object_key, row.optimized_object_key].filter((value): value is string => typeof value === "string" && value.length > 0);
    for (const key of Array.from(new Set(keys))) {
      try {
        await deleteR2ObjectDirect(key);
      } catch (error) {
        console.warn("R2 delete skipped", key, error);
      }
    }
  }
  const urls = [row.url, row.optimized_url].filter((value): value is string => typeof value === "string" && value.length > 0);
  for (const url of urls) await db.from("gallery_images").delete().eq("src", url);
  await db.from("gallery_images").update({ media_asset_id: null }).eq("media_asset_id", row.id as string);
  await db.from("asset_meta").delete().in("url", urls.length ? urls : [row.url as string]);
  const { error: deleteError } = await db.from("media_assets").delete().eq("id", row.id as string);
  if (deleteError) throw new Error(deleteError.message);
}

export async function inferMediaAssetForUrlDirect(url: string, alt?: string): Promise<{ id: string; url: string }> {
  const db = unsafeDb(true);
  const { data: existing, error: existingError } = await db
    .from("media_assets")
    .select("id, url, optimized_url")
    .or(`url.eq.${url},optimized_url.eq.${url}`)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return { id: existing.id as string, url: ((existing.optimized_url as string | null) ?? existing.url) as string };

  const provider = url.startsWith(R2_PUBLIC_URL) ? "r2" : url.startsWith("/__l5e/assets-v1/") ? "lovable_asset" : "external";
  const objectKey = provider === "r2" ? url.replace(`${R2_PUBLIC_URL}/`, "") : url;
  const { data, error } = await db
    .from("media_assets")
    .insert({
      storage_provider: provider,
      bucket: provider === "r2" ? R2_BUCKET : provider,
      object_key: objectKey,
      filename: filenameFromUrl(url),
      url,
      kind: kindFromUrl(url),
      content_type: contentTypeFromUrl(url),
      alt: alt ?? null,
      used_on_site: true,
    })
    .select("id, url")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, url: data.url as string };
}