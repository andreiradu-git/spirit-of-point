import { createClient } from "@supabase/supabase-js";
import { readServerEnv } from "@/lib/server-env";
import {
  deleteR2ObjectDirect,
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
  originalFilename?: string;
  mimeType?: string;
  mediaType?: string;
  extension?: string;
  width?: number;
  height?: number;
  duration?: number;
  uploadDate?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  folder?: string;
};

type Db = ReturnType<typeof createClient>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MediaDb = { from: (table: string) => any; rpc?: (...args: any[]) => any };
export type MediaAssetRuntimeSchema = {
  projectId?: string;
  supabaseUrl?: string;
  hasExtension: boolean;
  hasOptimizedSize: boolean;
  hasOptimizedUpdatedAt: boolean;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function basenameFromKey(key: unknown, fallback = "media"): string {
  if (typeof key !== "string" || key.length === 0) return fallback;
  const parts = key.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : key;
}

function extensionFromFilename(filename?: string): string | undefined {
  if (!filename) return undefined;
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) return undefined;
  const ext = filename
    .slice(dot + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return ext || undefined;
}

function folderFromKey(key: unknown): string | undefined {
  if (typeof key !== "string" || key.length === 0) return undefined;
  const slash = key.indexOf("/");
  if (slash <= 0) return undefined;
  return key.slice(0, slash);
}

function projectIdFromSupabaseUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(url).host;
    return host.endsWith(".supabase.co") ? host.replace(/\.supabase\.co$/, "") : host;
  } catch {
    return undefined;
  }
}

function dbFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    const authHeader = headers.get("Authorization");
    if (key.startsWith("sb_") && authHeader === "Bearer " + key) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

function mediaDbNotConfiguredResponse(missing: string[]): Response {
  return new Response(
    JSON.stringify({
      code: "MEDIA_DB_NOT_CONFIGURED",
      message: "Media database is not configured in this runtime.",
      missing,
    }),
    {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    },
  );
}

export function getMediaDbClient(service = false): Db {
  const url = readServerEnv("SUPABASE_URL") ?? readServerEnv("VITE_SUPABASE_URL");
  const key = service
    ? readServerEnv("SUPABASE_SERVICE_ROLE_KEY")
    : (readServerEnv("SUPABASE_PUBLISHABLE_KEY") ?? readServerEnv("VITE_SUPABASE_PUBLISHABLE_KEY"));

  const r2OnlyRaw = readServerEnv("R2_ONLY_MODE") ?? "";
  const r2OnlyFlag = r2OnlyRaw.toLowerCase() === "true" || r2OnlyRaw === "1";

  if (!url || !key) {
    if (!r2OnlyFlag) {
      const missing = [
        ...(!url ? ["SUPABASE_URL or VITE_SUPABASE_URL"] : []),
        ...(service
          ? !key
            ? ["SUPABASE_SERVICE_ROLE_KEY"]
            : []
          : !key
            ? ["SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY"]
            : []),
      ];
      throw mediaDbNotConfiguredResponse(missing);
    }

    const makeStubQuery = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        select: function () {
          return this;
        },
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
        insert: async () => ({ data: null, error: null }),
        upsert: async () => ({ data: null, error: null }),
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
        then: function (
          onFulfilled: (value: { data: unknown[]; error: null }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected);
        },
        catch: function (onRejected?: (reason: unknown) => unknown) {
          return Promise.resolve({ data: [], error: null }).catch(onRejected);
        },
        finally: function (onFinally?: (() => void) | undefined) {
          return Promise.resolve({ data: [], error: null }).finally(onFinally);
        },
      };
      return chain;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stubClient: any = {
      from: (_table: string) => makeStubQuery(),
      rpc: async () => ({ data: true, error: null }),
    };

    return stubClient as Db;
  }

  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { fetch: dbFetch(key) },
  });
}

function resolveDb(db: MediaDb | undefined, service = false): MediaDb {
  if (db && typeof db.from === "function") return db;
  return getMediaDbClient(service) as unknown as MediaDb;
}

const runtimeSchemaCache = new WeakMap<object, Promise<MediaAssetRuntimeSchema>>();

function isMissingColumnError(
  error: { message?: string } | null | undefined,
  column: string,
): boolean {
  const message = error?.message ?? "";
  return (
    message.includes(`Could not find the '${column}' column`) ||
    message.includes(`column "${column}" does not exist`)
  );
}

async function detectMediaAssetColumn(db: MediaDb, column: string): Promise<boolean> {
  const { error } = await db.from("media_assets").select(column).limit(1);
  if (!error) return true;
  if (isMissingColumnError(error, column)) return false;
  throw new Error(error.message);
}

export async function getMediaAssetRuntimeSchema(options?: {
  db?: MediaDb;
  service?: boolean;
}): Promise<MediaAssetRuntimeSchema> {
  const db = resolveDb(options?.db, options?.service ?? false);
  const cached = runtimeSchemaCache.get(db as object);
  if (cached) return cached;

  const promise = (async () => {
    const supabaseUrl = readServerEnv("SUPABASE_URL") ?? readServerEnv("VITE_SUPABASE_URL");
    const [hasExtension, hasOptimizedSize, hasOptimizedUpdatedAt] = await Promise.all([
      detectMediaAssetColumn(db, "extension"),
      detectMediaAssetColumn(db, "optimized_size"),
      detectMediaAssetColumn(db, "optimized_updated_at"),
    ]);
    return {
      projectId: projectIdFromSupabaseUrl(supabaseUrl),
      supabaseUrl,
      hasExtension,
      hasOptimizedSize,
      hasOptimizedUpdatedAt,
    };
  })();

  runtimeSchemaCache.set(db as object, promise);
  return promise;
}

function selectMediaAssetColumns(schema: MediaAssetRuntimeSchema): string {
  return [
    "id",
    "storage_provider",
    "bucket",
    "object_key",
    "filename",
    "original_filename",
    "url",
    "kind",
    "media_type",
    "content_type",
    "mime_type",
    ...(schema.hasExtension ? ["extension"] : []),
    "size",
    "width",
    "height",
    "duration",
    "folder",
    "upload_date",
    "optimized_object_key",
    "optimized_url",
    ...(schema.hasOptimizedSize ? ["optimized_size"] : []),
    ...(schema.hasOptimizedUpdatedAt ? ["optimized_updated_at"] : []),
    "alt",
    "tags",
    "used_on_site",
    "created_at",
    "updated_at",
  ].join(", ");
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
  if (/\.pdf(\?|$)/.test(lower)) return "application/pdf";
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

function r2ObjectKeyFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const publicOrigin = new URL(R2_PUBLIC_URL).origin;
    if (parsed.origin !== publicOrigin) return undefined;
    return parsed.pathname.replace(/^\/+/, "") || undefined;
  } catch {
    return undefined;
  }
}

function rowToAsset(row: Record<string, unknown>): SiteAsset | null {
  const rawUrl = asString(row.url) ?? asString(row.optimized_url);
  if (!rawUrl) return null;

  const inferredKind = kindFromUrl(rawUrl);
  const kind = (row.kind as SiteAsset["kind"] | undefined) ?? inferredKind;
  const optimizedUrl = asString(row.optimized_url);
  const url = kind === "image" && optimizedUrl ? optimizedUrl : rawUrl;
  const storageProvider = row.storage_provider as SiteAsset["storageProvider"] | undefined;
  const objectKey = asString(row.object_key);
  const filename = asString(row.filename) ?? filenameFromUrl(url);

  return {
    id: asString(row.id),
    kind,
    url,
    source:
      storageProvider === "r2"
        ? "Cloudflare R2"
        : storageProvider === "lovable_asset"
          ? "Legacy Lovable asset"
          : "Legacy external media",
    alt: (row.alt as string | null | undefined) ?? null,
    name: filename,
    size: asNumber(row.size),
    contentType: asString(row.content_type) ?? contentTypeFromUrl(url),
    lastModified: asString(row.updated_at),
    storageProvider,
    bucket: asString(row.bucket),
    objectKey,
    r2Key: storageProvider === "r2" ? objectKey : undefined,
    optimizedKey: asString(row.optimized_object_key),
    optimizedUrl,
    optimizedSize: asNumber(row.optimized_size),
    optimizedLastModified: asString(row.optimized_updated_at),
    usedOnSite: Boolean(row.used_on_site),
    originalFilename: asString(row.original_filename) ?? filename,
    mimeType: asString(row.mime_type) ?? asString(row.content_type) ?? contentTypeFromUrl(url),
    mediaType: asString(row.media_type) ?? kind,
    extension: asString(row.extension) ?? extensionFromFilename(filename),
    width: asNumber(row.width),
    height: asNumber(row.height),
    duration: asNumber(row.duration),
    uploadDate: asString(row.upload_date) ?? asString(row.created_at),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    tags: Array.isArray(row.tags)
      ? row.tags.filter((tag): tag is string => typeof tag === "string")
      : undefined,
    folder: asString(row.folder) ?? folderFromKey(objectKey),
  };
}

function r2Row(
  object: R2Object,
  schema: MediaAssetRuntimeSchema,
  optimized?: R2Object,
): Record<string, unknown> {
  const filename = asString(object.originalName) ?? basenameFromKey(object.key, "media");
  const kind = kindFromUrl(object.url);
  const contentType = object.contentType ?? contentTypeFromUrl(object.url);
  return {
    storage_provider: "r2",
    bucket: R2_BUCKET,
    object_key: object.key,
    filename,
    original_filename: filename,
    url: object.url,
    kind,
    media_type: kind,
    content_type: contentType,
    mime_type: contentType,
    ...(schema.hasExtension ? { extension: extensionFromFilename(filename) } : {}),
    size: object.size,
    optimized_object_key: optimized?.key ?? null,
    optimized_url: optimized?.url ?? null,
    ...(schema.hasOptimizedSize ? { optimized_size: optimized?.size ?? null } : {}),
    ...(schema.hasOptimizedUpdatedAt
      ? { optimized_updated_at: optimized?.lastModified ?? null }
      : {}),
    upload_date: object.lastModified ?? new Date().toISOString(),
    folder: folderFromKey(object.key) ?? "uploads",
  };
}

export async function syncR2MediaAssetsDirect(options?: { db?: MediaDb }): Promise<void> {
  const objects = await listR2ObjectsDirect();
  const db = resolveDb(options?.db, true);
  const schema = await getMediaAssetRuntimeSchema({ db, service: true });
  const byKey = new Map(objects.map((object) => [object.key, object]));
  const rows: Record<string, unknown>[] = [];
  for (const object of objects) {
    if (object.key.startsWith("optimized/")) continue;
    rows.push(r2Row(object, schema, byKey.get(optimizedKeyFor(object.key))));
  }
  for (const object of objects) {
    if (!object.key.startsWith("optimized/")) continue;
    const paired = rows.some((row) => row.optimized_object_key === object.key);
    if (!paired) rows.push(r2Row(object, schema));
  }
  if (!rows.length) return;
  const { error } = await db.from("media_assets").upsert(rows, { onConflict: "url" });
  if (error) throw new Error(error.message);
}

export async function listAllAssetsDirect(options?: {
  db?: MediaDb;
  syncFromR2?: boolean;
}): Promise<SiteAsset[]> {
  if (options?.syncFromR2) {
    await syncR2MediaAssetsDirect({ db: options.db });
  }

  const db = resolveDb(options?.db, false);
  const schema = await getMediaAssetRuntimeSchema({ db });
  const { data, error } = await db
    .from("media_assets")
    .select(selectMediaAssetColumns(schema))
    .order("upload_date", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => rowToAsset(row))
    .filter((asset): asset is SiteAsset => Boolean(asset));
}

export async function upsertMediaAssetDirect(
  input: {
    key: string;
    url: string;
    filename: string;
    kind: SiteAsset["kind"];
    contentType?: string;
    size?: number;
    width?: number;
    height?: number;
    duration?: number;
    originalFilename?: string;
    mediaType?: string;
    folder?: string;
    uploadDate?: string;
  },
  options?: { db?: MediaDb },
): Promise<void> {
  const db = resolveDb(options?.db, true);
  const schema = await getMediaAssetRuntimeSchema({ db, service: true });
  const filename = input.filename || basenameFromKey(input.key, "media");
  const mediaType = input.mediaType ?? input.kind;
  const contentType = input.contentType ?? contentTypeFromUrl(input.url);

  const { error } = await db.from("media_assets").upsert(
    {
      storage_provider: "r2",
      bucket: R2_BUCKET,
      object_key: input.key,
      filename,
      original_filename: input.originalFilename ?? filename,
      url: input.url,
      kind: input.kind,
      media_type: mediaType,
      content_type: contentType,
      mime_type: contentType,
      ...(schema.hasExtension ? { extension: extensionFromFilename(filename) } : {}),
      size: input.size,
      width: input.width,
      height: input.height,
      duration: input.duration,
      folder: input.folder ?? folderFromKey(input.key) ?? "uploads",
      upload_date: input.uploadDate ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "url" },
  );
  if (error) throw new Error(error.message);
}

export async function markOptimizedMediaAssetDirect(
  key: string,
  url: string,
  size?: number,
  options?: { db?: MediaDb },
): Promise<void> {
  const db = resolveDb(options?.db, true);
  const schema = await getMediaAssetRuntimeSchema({ db, service: true });
  const { data, error } = await db
    .from("media_assets")
    .select("id, object_key")
    .eq("storage_provider", "r2")
    .eq("kind", "image");
  if (error) throw new Error(error.message);
  const match = ((data ?? []) as Array<{ id: string; object_key: string }>).find(
    (row) => optimizedKeyFor(row.object_key) === key,
  );
  if (match) {
    const payload: Record<string, unknown> = {
      optimized_object_key: key,
      optimized_url: url,
      updated_at: new Date().toISOString(),
    };
    if (schema.hasOptimizedSize) payload.optimized_size = size;
    if (schema.hasOptimizedUpdatedAt) payload.optimized_updated_at = new Date().toISOString();
    const { error: updateError } = await db.from("media_assets").update(payload).eq("id", match.id);
    if (updateError) throw new Error(updateError.message);
    return;
  }

  await upsertMediaAssetDirect(
    {
      key,
      url,
      filename: basenameFromKey(key, key),
      kind: "image",
      contentType: "image/webp",
      mediaType: "image",
      size,
      uploadDate: new Date().toISOString(),
    },
    { db },
  );
}

export async function deleteMediaAssetDirect(
  input: { id?: string; key?: string; url?: string },
  options?: { db?: MediaDb },
): Promise<void> {
  const db = resolveDb(options?.db, true);
  const schema = await getMediaAssetRuntimeSchema({ db, service: true });
  let query = db.from("media_assets").select("*").limit(1);
  if (input.id) query = query.eq("id", input.id);
  else if (input.key)
    query = query.or(`object_key.eq.${input.key},optimized_object_key.eq.${input.key}`);
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
    const rowId = asString(row.id);
    if (!rowId) throw new Error("Media asset row is missing id");
    const payload: Record<string, unknown> = { optimized_object_key: null, optimized_url: null };
    if (schema.hasOptimizedSize) payload.optimized_size = null;
    if (schema.hasOptimizedUpdatedAt) payload.optimized_updated_at = null;
    const { error: updateError } = await db.from("media_assets").update(payload).eq("id", rowId);
    if (updateError) throw new Error(updateError.message);
    return;
  }

  if (row.storage_provider === "r2") {
    const keys = [row.object_key, row.optimized_object_key].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    for (const key of Array.from(new Set(keys))) {
      try {
        await deleteR2ObjectDirect(key);
      } catch (deleteError) {
        console.warn("R2 delete skipped", key, deleteError);
      }
    }
  }

  const urls = [row.url, row.optimized_url].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  for (const url of urls) await db.from("gallery_images").delete().eq("src", url);

  const rowId = asString(row.id);
  if (rowId) {
    await db.from("gallery_images").update({ media_asset_id: null }).eq("media_asset_id", rowId);
    const { error: deleteError } = await db.from("media_assets").delete().eq("id", rowId);
    if (deleteError) throw new Error(deleteError.message);
  }

  if (urls.length > 0) {
    await db.from("asset_meta").delete().in("url", urls);
  }
}

export async function inferMediaAssetForUrlDirect(
  url: string,
  alt?: string,
  options?: { db?: MediaDb },
): Promise<{ id: string; url: string }> {
  const db = resolveDb(options?.db, true);
  const schema = await getMediaAssetRuntimeSchema({ db, service: true });
  const { data: existing, error: existingError } = await db
    .from("media_assets")
    .select("id, url, optimized_url")
    .or(`url.eq.${url},optimized_url.eq.${url}`)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing)
    return {
      id: existing.id as string,
      url: ((existing.optimized_url as string | null) ?? existing.url) as string,
    };

  const r2ObjectKey = r2ObjectKeyFromUrl(url);
  const provider = r2ObjectKey
    ? "r2"
    : url.startsWith("/__l5e/assets-v1/")
      ? "lovable_asset"
      : "external";
  const objectKey = provider === "r2" ? (r2ObjectKey ?? url) : url;
  const filename = filenameFromUrl(url);
  const kind = kindFromUrl(url);
  const contentType = contentTypeFromUrl(url);

  const { data, error } = await db
    .from("media_assets")
    .insert({
      storage_provider: provider,
      bucket: provider === "r2" ? R2_BUCKET : provider,
      object_key: objectKey,
      filename,
      original_filename: filename,
      url,
      kind,
      media_type: kind,
      content_type: contentType,
      mime_type: contentType,
      ...(schema.hasExtension ? { extension: extensionFromFilename(filename) } : {}),
      alt: alt ?? null,
      used_on_site: true,
      folder: folderFromKey(objectKey) ?? provider,
      upload_date: new Date().toISOString(),
    })
    .select("id, url")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, url: data.url as string };
}
