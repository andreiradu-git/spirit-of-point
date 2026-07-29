import { createClient } from "@supabase/supabase-js";
import { readServerEnv } from "@/lib/server-env";
import {
  deleteR2ObjectDirect,
  getR2RuntimeDiagnostics,
  listR2ObjectsDirect,
  optimizedKeyFor,
  type R2Object,
} from "@/lib/r2.server";

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
type QueryError = { message?: string } | null;
type QueryData<T> = { data: T | null; error: QueryError };
type QueryResult = QueryData<unknown[] | Record<string, unknown>>;
type QueryChain = PromiseLike<QueryResult> & {
  select: (...args: unknown[]) => QueryChain;
  maybeSingle: () => Promise<QueryData<Record<string, unknown>>>;
  single: () => Promise<QueryData<Record<string, unknown>>>;
  insert: (...args: unknown[]) => QueryChain;
  upsert: (...args: unknown[]) => Promise<{ error: QueryError }>;
  update: (...args: unknown[]) => QueryChain;
  delete: (...args: unknown[]) => QueryChain;
  eq: (...args: unknown[]) => QueryChain;
  or: (...args: unknown[]) => QueryChain;
  limit: (...args: unknown[]) => QueryChain;
  order: (...args: unknown[]) => QueryChain;
  in: (...args: unknown[]) => QueryChain;
};
type UnsafeDb = Omit<ReturnType<typeof createClient>, "from"> & {
  from: (table: string) => QueryChain;
};

const MEDIA_ASSET_COLUMNS = [
  "id",
  "storage_provider",
  "bucket",
  "object_key",
  "filename",
  "url",
  "kind",
  "content_type",
  "size",
  "optimized_object_key",
  "optimized_url",
  "original_object_key",
  "original_url",
  "label",
  "alt",
  "caption",
  "description",
  "tags",
  "used_on_site",
  "created_at",
  "updated_at",
] as const;

const MEDIA_ASSET_SELECT = MEDIA_ASSET_COLUMNS.join(", ");
const MEDIA_ASSET_META_SELECT = "url, optimized_url, label, alt, caption, description, tags";

export type MetadataBackendStatus = "healthy" | "unavailable" | "error";

type MediaDiagnosticsState = {
  lastSqlQuery: string | null;
  lastSqlError: string | null;
  metadataBackendStatus: MetadataBackendStatus;
  metadataBackendMessage: string | null;
};

export type MediaDiagnosticsSnapshot = MediaDiagnosticsState & {
  totalR2Objects: number | null;
  totalMetadataRecords: number | null;
  workerEnvironment: string;
  hasBucketBinding: boolean;
  bucketBindingName: string;
  hasSupabaseUrl: boolean;
  hasSupabasePublishableKey: boolean;
  hasSupabaseServiceRoleKey: boolean;
};

declare global {
  var __POINTSTUDIO_MEDIA_DIAGNOSTICS__: MediaDiagnosticsState | undefined;
}

function getDiagnosticsState(): MediaDiagnosticsState {
  if (!globalThis.__POINTSTUDIO_MEDIA_DIAGNOSTICS__) {
    globalThis.__POINTSTUDIO_MEDIA_DIAGNOSTICS__ = {
      lastSqlQuery: null,
      lastSqlError: null,
      metadataBackendStatus: "healthy",
      metadataBackendMessage: null,
    };
  }
  return globalThis.__POINTSTUDIO_MEDIA_DIAGNOSTICS__;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error instanceof Response) return `HTTP ${error.status}`;
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Unknown error";
}

function setMetadataState(
  status: MetadataBackendStatus,
  message: string | null,
  lastSqlQuery?: string | null,
  lastSqlError?: string | null,
) {
  const state = getDiagnosticsState();
  if (lastSqlQuery !== undefined) state.lastSqlQuery = lastSqlQuery;
  if (lastSqlError !== undefined) state.lastSqlError = lastSqlError;
  state.metadataBackendStatus = status;
  state.metadataBackendMessage = message;
}

function markSqlSuccess(query: string) {
  setMetadataState("healthy", null, query, null);
}

function markSqlFailure(query: string, error: unknown) {
  setMetadataState("error", errorMessage(error), query, errorMessage(error));
}

function markMetadataUnavailable(error: unknown, query?: string) {
  setMetadataState("unavailable", errorMessage(error), query, errorMessage(error));
}

function tryUnsafeDb(service = false): UnsafeDb | undefined {
  try {
    return unsafeDb(service);
  } catch (error) {
    markMetadataUnavailable(error);
    return undefined;
  }
}

function dbFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
      headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

export function getMediaDbClient(service = false): Db {
  const url = readServerEnv("SUPABASE_URL") ?? readServerEnv("VITE_SUPABASE_URL");
  const key = service
    ? readServerEnv("SUPABASE_SERVICE_ROLE_KEY")
    : (readServerEnv("SUPABASE_PUBLISHABLE_KEY") ?? readServerEnv("VITE_SUPABASE_PUBLISHABLE_KEY"));

  // If you want to run in an R2-only dev mode (no Supabase), set R2_ONLY_MODE=true in env.
  const r2OnlyFlag =
    (readServerEnv("R2_ONLY_MODE") || "").toLowerCase() === "true" ||
    readServerEnv("R2_ONLY_MODE") === "1";

  if (!url || !key) {
    if (!r2OnlyFlag) {
      // Return an HTTP 500 response to make missing dependency visible to monitoring
      throw new Response(
        JSON.stringify({ message: "Media database is not configured in this runtime." }),
        {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      );
    }

    // Minimal stub that implements the `.from(...).select/upsert/update/delete/...` chain
    // used across the media pipeline. Returns empty results or success objects.
    const makeStubQuery = (): QueryChain => {
      const chain: QueryChain = {
        then: ((onfulfilled, onrejected) =>
          Promise.resolve<QueryResult>({ data: [], error: null }).then(
            onfulfilled,
            onrejected,
          )) as PromiseLike<QueryResult>["then"],
        select: function () {
          return this;
        },
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
        insert: function () {
          return this;
        },
        upsert: async () => ({ error: null }),
        update: function () {
          return this;
        },
        delete: function () {
          return this;
        },
        eq: function () {
          return this;
        },
        or: function () {
          return this;
        },
        limit: function () {
          return this;
        },
        order: function () {
          return this;
        },
        in: function () {
          return this;
        },
      };
      return chain;
    };

    const stubClient = {
      from: (_table: string) => makeStubQuery(),
      rpc: async () => ({ data: true, error: null }),
    } as unknown as UnsafeDb;

    return stubClient as unknown as Db;
  }

  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { fetch: dbFetch(key) },
  });
}

function unsafeDb(service = false): UnsafeDb {
  return getMediaDbClient(service) as unknown as UnsafeDb;
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
    source:
      storageProvider === "r2"
        ? "Cloudflare R2"
        : storageProvider === "lovable_asset"
          ? "Legacy Lovable asset"
          : "Legacy external media",
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
    optimizedSize: undefined,
    optimizedLastModified: undefined,
    usedOnSite: Boolean(row.used_on_site),
  };
}

function r2ObjectToAsset(object: R2Object, optimized?: R2Object): SiteAsset {
  const kind = kindFromUrl(object.url);
  return {
    kind,
    url: kind === "image" && optimized?.url ? optimized.url : object.url,
    source: "Cloudflare R2",
    alt: null,
    name: object.originalName || object.key.split("/").filter(Boolean).pop() || object.key,
    size: object.size,
    contentType: object.contentType ?? contentTypeFromUrl(object.url),
    lastModified: object.lastModified,
    storageProvider: "r2",
    bucket: R2_BUCKET,
    objectKey: object.key,
    r2Key: object.key,
    optimizedKey: optimized?.key,
    optimizedUrl: optimized?.url,
    optimizedSize: optimized?.size,
    optimizedLastModified: optimized?.lastModified,
    usedOnSite: false,
    isOrphanOptimized: object.key.startsWith("optimized/"),
  };
}

/**
 * Builds the asset list directly from R2 by pairing each original object with
 * its optimized variant when present, then appending any remaining optimized
 * objects as standalone entries so no stored file is hidden from the admin UI.
 */
function buildAssetsFromR2(objects: R2Object[]): SiteAsset[] {
  const byKey = new Map(objects.map((object) => [object.key, object]));
  const seen = new Set<string>();
  const assets: SiteAsset[] = [];

  for (const object of objects) {
    if (object.key.startsWith("optimized/")) continue;
    const optimized =
      kindFromUrl(object.url) === "image" ? byKey.get(optimizedKeyFor(object.key)) : undefined;
    assets.push(r2ObjectToAsset(object, optimized));
    seen.add(object.key);
    if (optimized) seen.add(optimized.key);
  }

  for (const object of objects) {
    if (seen.has(object.key)) continue;
    assets.push(r2ObjectToAsset(object));
  }

  return assets.sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""));
}

function getR2ObjectKeyFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== R2_PUBLIC_URL) return undefined;
    return parsed.pathname.replace(/^\/+/, "");
  } catch {
    // Invalid or non-absolute URLs are treated as non-R2 values and handled by the caller.
    return undefined;
  }
}

function mergeMetadataIntoR2Assets(
  r2Assets: SiteAsset[],
  metadataRows: Array<Record<string, unknown>>,
): SiteAsset[] {
  const metadataAssets = metadataRows.map(rowToAsset);
  const metadataByKey = new Map(
    metadataAssets
      .filter((asset) => asset.storageProvider === "r2" && asset.r2Key)
      .map((asset) => [asset.r2Key as string, asset]),
  );
  const merged = r2Assets.map((asset) => {
    const metadata = asset.r2Key ? metadataByKey.get(asset.r2Key) : undefined;
    if (!metadata) return asset;
    return {
      ...asset,
      id: metadata.id,
      alt: metadata.alt,
      usedOnSite: metadata.usedOnSite,
      optimizedKey: asset.optimizedKey ?? metadata.optimizedKey,
      optimizedUrl: asset.optimizedUrl ?? metadata.optimizedUrl,
      optimizedSize: asset.optimizedSize ?? metadata.optimizedSize,
      optimizedLastModified: asset.optimizedLastModified ?? metadata.optimizedLastModified,
      url: asset.url,
      source: metadata.source,
      storageProvider: metadata.storageProvider,
      bucket: metadata.bucket ?? asset.bucket,
      contentType: asset.contentType ?? metadata.contentType,
      name: asset.name ?? metadata.name,
      size: asset.size ?? metadata.size,
      lastModified: asset.lastModified ?? metadata.lastModified,
    };
  });

  const extraAssets = metadataAssets.filter(
    (asset) => asset.storageProvider !== "r2" || !asset.r2Key || !metadataByKey.has(asset.r2Key),
  );
  return [...merged, ...extraAssets].sort((a, b) =>
    (b.lastModified ?? "").localeCompare(a.lastModified ?? ""),
  );
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
  const db = tryUnsafeDb(true);
  if (!db) return;
  const query =
    "UPSERT media_assets (storage_provider, bucket, object_key, filename, url, kind, content_type, size, optimized_object_key, optimized_url)";
  const { error } = await db.from("media_assets").upsert(rows, { onConflict: "url" });
  if (error) {
    markSqlFailure(query, error);
    throw new Error(error.message);
  }
  markSqlSuccess(query);
}

export async function listAllAssetsDirect(): Promise<SiteAsset[]> {
  const r2Objects = await listR2ObjectsDirect();
  const r2Assets = buildAssetsFromR2(r2Objects);
  try {
    await syncR2MediaAssetsDirect();
  } catch (error) {
    console.warn("Media R2 sync skipped", error);
  }
  const db = tryUnsafeDb(false);
  if (!db) return r2Assets;
  const query = `SELECT ${MEDIA_ASSET_SELECT} FROM media_assets ORDER BY updated_at DESC`;
  const { data, error } = await db
    .from("media_assets")
    .select(MEDIA_ASSET_SELECT)
    .order("updated_at", { ascending: false });
  if (error) {
    markSqlFailure(query, error);
    return r2Assets;
  }
  markSqlSuccess(query);
  return mergeMetadataIntoR2Assets(r2Assets, (data ?? []) as Array<Record<string, unknown>>);
}

export async function upsertMediaAssetDirect(input: {
  key: string;
  url: string;
  filename: string;
  kind: SiteAsset["kind"];
  contentType?: string;
  size?: number;
}): Promise<void> {
  const db = tryUnsafeDb(true);
  if (!db) throw new Error("Media metadata backend unavailable");
  const query =
    "UPSERT media_assets (storage_provider, bucket, object_key, filename, url, kind, content_type, size)";
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
  if (error) {
    markSqlFailure(query, error);
    throw new Error(error.message);
  }
  markSqlSuccess(query);
}

export async function markOptimizedMediaAssetDirect(
  key: string,
  url: string,
  size?: number,
): Promise<void> {
  const db = tryUnsafeDb(true);
  if (!db) throw new Error("Media metadata backend unavailable");
  const selectQuery =
    "SELECT id, object_key FROM media_assets WHERE storage_provider = 'r2' AND kind = 'image'";
  const { data, error } = await db
    .from("media_assets")
    .select("id, object_key")
    .eq("storage_provider", "r2")
    .eq("kind", "image");
  if (error) {
    markSqlFailure(selectQuery, error);
    throw new Error(error.message);
  }
  markSqlSuccess(selectQuery);
  const match = ((data ?? []) as Array<{ id: string; object_key: string }>).find(
    (row) => optimizedKeyFor(row.object_key) === key,
  );
  if (match) {
    const updateQuery =
      "UPDATE media_assets SET optimized_object_key, optimized_url, updated_at WHERE id = ?";
    const { error: updateError } = await db
      .from("media_assets")
      .update({
        optimized_object_key: key,
        optimized_url: url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id);
    if (updateError) {
      markSqlFailure(updateQuery, updateError);
      throw new Error(updateError.message);
    }
    markSqlSuccess(updateQuery);
    return;
  }
  await upsertMediaAssetDirect({
    key,
    url,
    filename: key.split("/").pop() ?? key,
    kind: "image",
    contentType: "image/webp",
    size,
  });
}

export async function deleteMediaAssetDirect(input: {
  id?: string;
  key?: string;
  url?: string;
}): Promise<void> {
  const db = tryUnsafeDb(true);
  if (!db) {
    if (input.key) {
      await deleteR2ObjectDirect(input.key);
      return;
    }
    throw new Error("Media metadata backend unavailable");
  }
  let query = db.from("media_assets").select("*").limit(1);
  if (input.id) query = query.eq("id", input.id);
  else if (input.key)
    query = query.or(`object_key.eq.${input.key},optimized_object_key.eq.${input.key}`);
  else if (input.url) query = query.or(`url.eq.${input.url},optimized_url.eq.${input.url}`);
  else throw new Error("Missing media asset id, key, or url");
  const lookupQuery = "SELECT * FROM media_assets LIMIT 1";
  const { data, error } = await query.maybeSingle();
  if (error) {
    markSqlFailure(lookupQuery, error);
    if (input.key) {
      await deleteR2ObjectDirect(input.key);
      return;
    }
    throw new Error(error.message);
  }
  markSqlSuccess(lookupQuery);
  const row = data as Record<string, unknown> | null;
  if (!row) {
    if (input.key) await deleteR2ObjectDirect(input.key);
    return;
  }

  if (input.key && row.optimized_object_key === input.key && row.object_key !== input.key) {
    await deleteR2ObjectDirect(input.key);
    const clearOptimizedQuery =
      "UPDATE media_assets SET optimized_object_key = null, optimized_url = null WHERE id = ?";
    const { error: updateError } = await db
      .from("media_assets")
      .update({ optimized_object_key: null, optimized_url: null })
      .eq("id", row.id as string);
    if (updateError) {
      markSqlFailure(clearOptimizedQuery, updateError);
      throw new Error(updateError.message);
    }
    markSqlSuccess(clearOptimizedQuery);
    return;
  }

  if (row.storage_provider === "r2") {
    const keys = [row.object_key, row.optimized_object_key].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    for (const key of Array.from(new Set(keys))) {
      try {
        await deleteR2ObjectDirect(key);
      } catch (error) {
        console.warn("R2 delete skipped", key, error);
      }
    }
  }
  const urls = [row.url, row.optimized_url].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  for (const url of urls) await db.from("gallery_images").delete().eq("src", url);
  await db
    .from("gallery_images")
    .update({ media_asset_id: null })
    .eq("media_asset_id", row.id as string);
  await db
    .from("asset_meta")
    .delete()
    .in("url", urls.length ? urls : [row.url as string]);
  const deleteQuery = "DELETE FROM media_assets WHERE id = ?";
  const { error: deleteError } = await db
    .from("media_assets")
    .delete()
    .eq("id", row.id as string);
  if (deleteError) {
    markSqlFailure(deleteQuery, deleteError);
    throw new Error(deleteError.message);
  }
  markSqlSuccess(deleteQuery);
}

export async function inferMediaAssetForUrlDirect(
  url: string,
  alt?: string,
): Promise<{ id: string; url: string }> {
  const db = tryUnsafeDb(true);
  if (!db) throw new Error("Media metadata backend unavailable");
  const selectQuery =
    "SELECT id, url, optimized_url FROM media_assets WHERE url = ? OR optimized_url = ?";
  const { data: existing, error: existingError } = await db
    .from("media_assets")
    .select("id, url, optimized_url")
    .or(`url.eq.${url},optimized_url.eq.${url}`)
    .maybeSingle();
  if (existingError) {
    markSqlFailure(selectQuery, existingError);
    throw new Error(existingError.message);
  }
  markSqlSuccess(selectQuery);
  if (existing)
    return {
      id: existing.id as string,
      url: ((existing.optimized_url as string | null) ?? existing.url) as string,
    };

  const r2ObjectKey = getR2ObjectKeyFromUrl(url);
  const provider = r2ObjectKey
    ? "r2"
    : url.startsWith("/__l5e/assets-v1/")
      ? "lovable_asset"
      : "external";
  const objectKey = provider === "r2" ? (r2ObjectKey ?? url) : url;
  const insertQuery =
    "INSERT INTO media_assets (storage_provider, bucket, object_key, filename, url, kind, content_type, alt, used_on_site)";
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
  if (error) {
    markSqlFailure(insertQuery, error);
    throw new Error(error.message);
  }
  markSqlSuccess(insertQuery);
  if (!data) throw new Error("Media metadata insert returned no row");
  return { id: data.id as string, url: data.url as string };
}

export async function listAssetMetaDirect(): Promise<
  Array<{
    url: string;
    label: string | null;
    alt: string | null;
    caption: string | null;
    description: string | null;
    tags: string[];
  }>
> {
  const db = tryUnsafeDb(false);
  if (!db) return [];
  const query = `SELECT ${MEDIA_ASSET_META_SELECT} FROM media_assets`;
  const { data, error } = await db.from("media_assets").select(MEDIA_ASSET_META_SELECT);
  if (error) {
    markSqlFailure(query, error);
    return [];
  }
  markSqlSuccess(query);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    url: String((row.optimized_url as string | null | undefined) ?? row.url ?? ""),
    label: typeof row.label === "string" ? row.label : null,
    alt: typeof row.alt === "string" ? row.alt : null,
    caption: typeof row.caption === "string" ? row.caption : null,
    description: typeof row.description === "string" ? row.description : null,
    tags: Array.isArray(row.tags)
      ? row.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
  }));
}

export async function getMediaDiagnosticsDirect(): Promise<MediaDiagnosticsSnapshot> {
  const state = getDiagnosticsState();
  const runtime = await getR2RuntimeDiagnostics();

  let totalR2Objects: number | null = null;
  try {
    totalR2Objects = (await listR2ObjectsDirect()).length;
  } catch {
    totalR2Objects = null;
  }

  let totalMetadataRecords: number | null = null;
  const db = tryUnsafeDb(false);
  if (db) {
    const query = "SELECT id FROM media_assets";
    const { data, error } = await db.from("media_assets").select("id");
    if (error) {
      markSqlFailure(query, error);
    } else {
      markSqlSuccess(query);
      totalMetadataRecords = Array.isArray(data) ? data.length : 0;
    }
  }

  const env = globalThis.__POINTSTUDIO_WORKER_RUNTIME__ ?? runtime.runtime;
  return {
    totalR2Objects,
    totalMetadataRecords,
    lastSqlQuery: state.lastSqlQuery,
    lastSqlError: state.lastSqlError,
    metadataBackendStatus: state.metadataBackendStatus,
    metadataBackendMessage: state.metadataBackendMessage,
    workerEnvironment: env,
    hasBucketBinding: runtime.hasBucketBinding,
    bucketBindingName: runtime.bindingName,
    hasSupabaseUrl: Boolean(readServerEnv("SUPABASE_URL") ?? readServerEnv("VITE_SUPABASE_URL")),
    hasSupabasePublishableKey: Boolean(
      readServerEnv("SUPABASE_PUBLISHABLE_KEY") ?? readServerEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
    ),
    hasSupabaseServiceRoleKey: Boolean(readServerEnv("SUPABASE_SERVICE_ROLE_KEY")),
  };
}
