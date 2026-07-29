import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { requireAdminDb, type AdminDb } from "@/lib/admin-db-context";
import {
  deleteMediaAssetDirect,
  getMediaAssetRuntimeSchema,
  markOptimizedMediaAssetDirect,
  upsertMediaAssetDirect,
} from "@/lib/media-assets.server";
import {
  b64ToBytes,
  deleteR2ObjectDirect,
  getR2Client,
  inferKindFromContentType,
  listR2ObjectsDirect,
  makeR2Key,
  putR2Object,
  readR2ObjectDirect,
  sanitizeFileName,
  type AssetKind,
} from "@/lib/r2.server";

export type { R2Object } from "@/lib/r2.server";

const PUBLIC_URL = "https://images.pointstudio.ro";
const MEDIA_ASSET_LOOKUP_SQL =
  "SELECT id, object_key, optimized_object_key, url, optimized_url, used_on_site FROM public.media_assets WHERE storage_provider = 'r2'";
const GALLERY_IMAGES_SQL = "SELECT src, gallery_id, media_asset_id FROM public.gallery_images";
const SITE_SETTINGS_SQL = "SELECT key, value FROM public.site_settings";
const PAGES_SQL = "SELECT slug, body FROM public.pages";
const PAGE_SEO_SQL = "SELECT path, og_image FROM public.page_seo";
const ASSET_META_SQL = "SELECT url FROM public.asset_meta";

type CleanupMediaAssetRow = {
  id?: string;
  object_key?: string | null;
  optimized_object_key?: string | null;
  url?: string | null;
  optimized_url?: string | null;
  used_on_site?: boolean | null;
};

function stemFromKey(key?: string | null): string | undefined {
  if (!key) return undefined;
  const base = key.split("/").filter(Boolean).pop() ?? key;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

function normalizedLookupKey(key: string): string {
  return stemFromKey(key) ?? key;
}

function comparisonValuesForRow(row: CleanupMediaAssetRow): string[] {
  return [
    row.object_key,
    row.optimized_object_key,
    row.url,
    row.optimized_url,
    ...(row.used_on_site ? ["used_on_site=true"] : []),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
}

function buildReferenceSources(
  row: CleanupMediaAssetRow,
  referencedById: Set<string>,
  referenceIndex: Array<{ source: string; text: string }>,
): string[] {
  const sources = new Set<string>();
  if (row.id && referencedById.has(row.id)) sources.add("gallery_images.media_asset_id");
  for (const candidate of comparisonValuesForRow(row)) {
    for (const ref of referenceIndex) {
      if (ref.text.includes(candidate)) sources.add(ref.source);
    }
  }
  if (row.used_on_site) sources.add("media_assets.used_on_site");
  return Array.from(sources);
}

function findMediaAssetRowForObject(
  objectKey: string,
  rowsByExactKey: Map<string, CleanupMediaAssetRow>,
  rowsByStem: Map<string, CleanupMediaAssetRow>,
): CleanupMediaAssetRow | undefined {
  return rowsByExactKey.get(objectKey) ?? rowsByStem.get(normalizedLookupKey(objectKey));
}

async function buildStorageCleanupReport(db: AdminDb) {
  const safe = async <T>(p: PromiseLike<{ data: T | null }>): Promise<{ data: T | null }> => {
    try {
      return await p;
    } catch (e) {
      console.warn("[storage-cleanup] CMS query failed, continuing:", e);
      return { data: null };
    }
  };

  console.info("[storage-cleanup] SQL", {
    mediaAssets: MEDIA_ASSET_LOOKUP_SQL,
    galleryImages: GALLERY_IMAGES_SQL,
    siteSettings: SITE_SETTINGS_SQL,
    pages: PAGES_SQL,
    pageSeo: PAGE_SEO_SQL,
    assetMeta: ASSET_META_SQL,
  });

  const [objects, mediaAssets, galleries, settings, pages, pageSeo, assetMeta, schema] =
    await Promise.all([
      listR2ObjectsDirect().catch((e) => {
        console.error("[storage-cleanup] R2 list failed", e);
        return [] as Awaited<ReturnType<typeof listR2ObjectsDirect>>;
      }),
      safe<CleanupMediaAssetRow[]>(
        db
          .from("media_assets")
          .select("id, object_key, optimized_object_key, url, optimized_url, used_on_site")
          .eq("storage_provider", "r2"),
      ),
      safe<Array<{ src?: string; gallery_id?: string; media_asset_id?: string }>>(
        db.from("gallery_images").select("src, gallery_id, media_asset_id"),
      ),
      safe<Array<{ key?: string; value?: unknown }>>(db.from("site_settings").select("key, value")),
      safe<Array<{ slug?: string; body?: unknown }>>(db.from("pages").select("slug, body")),
      safe<Array<{ path?: string; og_image?: string }>>(
        db.from("page_seo").select("path, og_image"),
      ),
      safe<Array<{ url?: string }>>(db.from("asset_meta").select("url")),
      getMediaAssetRuntimeSchema({ db }),
    ]);

  const haystackParts: string[] = [];
  const referenceIndex: Array<{ source: string; text: string }> = [];

  for (const row of galleries.data ?? []) {
    if (row.src) {
      haystackParts.push(row.src);
      referenceIndex.push({ source: "gallery_images.src", text: row.src });
    }
  }
  for (const row of settings.data ?? []) {
    const json = JSON.stringify(row.value ?? "");
    haystackParts.push(json);
    referenceIndex.push({ source: `site_settings:${row.key}`, text: json });
  }
  for (const row of pages.data ?? []) {
    const json = JSON.stringify(row.body ?? "");
    haystackParts.push(json);
    referenceIndex.push({ source: `page:${row.slug}`, text: json });
  }
  for (const row of pageSeo.data ?? []) {
    if (row.og_image) {
      haystackParts.push(row.og_image);
      referenceIndex.push({ source: `page_seo:${row.path}`, text: row.og_image });
    }
  }
  for (const row of assetMeta.data ?? []) {
    if (row.url) {
      haystackParts.push(row.url);
      referenceIndex.push({ source: "asset_meta", text: row.url });
    }
  }

  try {
    const videos = (await import("@/data/videos.json")).default as Array<{ src: string }>;
    for (const v of videos) {
      haystackParts.push(v.src);
      referenceIndex.push({ source: "videos.json", text: v.src });
    }
  } catch {
    /* optional */
  }

  const haystack = haystackParts.join("\n");
  const referencedById = new Set(
    (galleries.data ?? [])
      .map((row) => row.media_asset_id)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );

  const mediaRows = (mediaAssets.data ?? []) as CleanupMediaAssetRow[];
  const rowsByExactKey = new Map<string, CleanupMediaAssetRow>();
  const rowsByStem = new Map<string, CleanupMediaAssetRow>();
  for (const row of mediaRows) {
    for (const key of [row.object_key, row.optimized_object_key]) {
      if (typeof key === "string" && key.length > 0) {
        rowsByExactKey.set(key, row);
        rowsByStem.set(normalizedLookupKey(key), row);
      }
    }
  }

  let orphanBytes = 0;
  let matchedMediaAssetCount = 0;
  const report = objects.map((obj) => {
    const normalizedKey = normalizedLookupKey(obj.key);
    const matchedRow = findMediaAssetRowForObject(obj.key, rowsByExactKey, rowsByStem);
    if (matchedRow) matchedMediaAssetCount += 1;

    const comparisonValues = matchedRow ? comparisonValuesForRow(matchedRow) : [obj.key, obj.url];
    const referencedIn = matchedRow
      ? buildReferenceSources(matchedRow, referencedById, referenceIndex)
      : referenceIndex
          .filter((r) => r.text.includes(obj.url) || r.text.includes(obj.key))
          .map((r) => r.source);
    const referenced =
      referencedIn.length > 0 ||
      comparisonValues.some((value) => haystack.includes(value)) ||
      (matchedRow?.id ? referencedById.has(matchedRow.id) : false);

    if (!referenced) orphanBytes += obj.size;

    return {
      key: obj.key,
      url: obj.url,
      size: obj.size,
      uploaded: obj.lastModified,
      contentType: obj.contentType,
      originalName: obj.originalName,
      referenced,
      referencedIn: Array.from(new Set(referencedIn)),
      lookupDiagnostic: {
        normalizedKey,
        sql: MEDIA_ASSET_LOOKUP_SQL,
        matchedMediaAssetId: matchedRow?.id ?? null,
        matchedObjectKey: matchedRow?.object_key ?? null,
        matchedOptimizedKey: matchedRow?.optimized_object_key ?? null,
        comparisonValues,
        reason: referenced
          ? matchedRow
            ? "Matched media_assets row and found a CMS/media_assets reference for that asset pair."
            : "Matched legacy string reference without a media_assets row."
          : matchedRow
            ? "Matched media_assets row, but neither media_asset_id nor any URL/key reference points at it."
            : "No media_assets row matched this R2 object, and no CMS string reference matched its key or URL.",
      },
    };
  });

  const allObjectsMarkedOrphan = report.length > 0 && report.every((row) => !row.referenced);
  const hasAnyTrackedMedia = mediaRows.length > 0;
  const lookupHealthy = !(
    allObjectsMarkedOrphan &&
    hasAnyTrackedMedia &&
    matchedMediaAssetCount === 0
  );
  const deletionBlockedReason = lookupHealthy
    ? null
    : "Storage cleanup lookup is unhealthy: no R2 objects matched any media_assets rows, so deletion is blocked until the lookup is repaired.";

  return {
    bucketPublicUrl: PUBLIC_URL,
    databaseProjectId: schema.projectId ?? null,
    databaseUrl: schema.supabaseUrl ?? null,
    mediaAssetSchema: schema,
    totalObjects: report.length,
    totalBytes: report.reduce((n, r) => n + r.size, 0),
    orphanCount: report.filter((r) => !r.referenced).length,
    orphanBytes,
    matchedMediaAssetCount,
    mediaAssetRowCount: mediaRows.length,
    lookupHealthy,
    deletionBlockedReason,
    scannedAt: new Date().toISOString(),
    objects: report,
  };
}

// -----------------------------------------------------------------------------
// R2-only image pipeline (no Supabase). Image upload / optimize / delete only
// depend on the Cloudflare R2 binding.
// -----------------------------------------------------------------------------

export const readR2Object = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ key: z.string().min(1).max(600) }).parse(input))
  .handler(async ({ data }) => readR2ObjectDirect(data.key));

const variantSchema = z.object({
  key: z.string().min(1).max(700),
  contentType: z.string().min(1).max(160),
  dataBase64: z.string().min(1),
});

// Writes the single optimized display file, plus an optional backup of the
// untouched original. `siblings` is kept for backward compatibility but the
// current pipeline never sends any.
export const writeR2Variants = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input) =>
    z
      .object({
        main: variantSchema,
        siblings: z.array(variantSchema).max(6).optional().default([]),
        backup: variantSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = requireAdminDb(context);
    const results: Array<{ key: string; size: number; url: string }> = [];
    if (data.backup) {
      const body = b64ToBytes(data.backup.dataBase64);
      const url = await putR2Object(data.backup.key, body, data.backup.contentType);
      await upsertMediaAssetDirect(
        {
          key: data.backup.key,
          url,
          filename: data.backup.key.split("/").pop() ?? data.backup.key,
          kind: inferKindFromContentType(data.backup.contentType, data.backup.key),
          contentType: data.backup.contentType,
          size: body.byteLength,
        },
        { db },
      );
      results.push({ key: data.backup.key, size: body.byteLength, url });
    }
    const main = b64ToBytes(data.main.dataBase64);
    const mainUrl = await putR2Object(data.main.key, main, data.main.contentType);
    if (data.main.key.startsWith("optimized/")) {
      await markOptimizedMediaAssetDirect(data.main.key, mainUrl, main.byteLength, { db });
    } else {
      await upsertMediaAssetDirect(
        {
          key: data.main.key,
          url: mainUrl,
          filename: data.main.key.split("/").pop() ?? data.main.key,
          kind: inferKindFromContentType(data.main.contentType, data.main.key),
          contentType: data.main.contentType,
          size: main.byteLength,
        },
        { db },
      );
    }
    results.push({ key: data.main.key, size: main.byteLength, url: mainUrl });
    for (const s of data.siblings) {
      const body = b64ToBytes(s.dataBase64);
      const url = await putR2Object(s.key, body, s.contentType);
      await upsertMediaAssetDirect(
        {
          key: s.key,
          url,
          filename: s.key.split("/").pop() ?? s.key,
          kind: inferKindFromContentType(s.contentType, s.key),
          contentType: s.contentType,
          size: body.byteLength,
        },
        { db },
      );
      results.push({ key: s.key, size: body.byteLength, url });
    }
    return { ok: true, results };
  });

export const renameR2Object = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input) =>
    z
      .object({
        fromKey: z.string().min(1).max(600),
        toName: z.string().min(1).max(240),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // Object keys use UUIDs; "rename" only updates the displayed original
    // filename stored in R2 customMetadata. The key and public URL never change.
    const source = await readR2ObjectDirect(data.fromKey);
    const clean = sanitizeFileName(data.toName) || "file";
    await putR2Object(data.fromKey, b64ToBytes(source.dataBase64), source.contentType, clean);
    return {
      ok: true,
      key: data.fromKey,
      url: `${PUBLIC_URL}/${data.fromKey}`,
      displayName: clean,
    };
  });

const uploadSchema = z.object({
  filename: z.string().min(1).max(240),
  contentType: z.string().max(160).optional().default("application/octet-stream"),
  dataBase64: z.string().min(1),
  kind: z.enum(["image", "video", "file"]).optional(),
  originalFilename: z.string().max(240).optional(),
  width: z.number().int().positive().max(50000).optional(),
  height: z.number().int().positive().max(50000).optional(),
  duration: z
    .number()
    .positive()
    .max(60 * 60 * 12)
    .optional(),
  uploadDate: z.string().datetime().optional(),
  // Legacy — ignored, kept for backward compatibility with existing callers.
  folder: z.string().max(120).optional(),
});

export const uploadToR2 = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input) => uploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = requireAdminDb(context);
    const kind: AssetKind = data.kind ?? inferKindFromContentType(data.contentType, data.filename);
    const key = makeR2Key(kind, data.filename);
    const body = b64ToBytes(data.dataBase64);
    const url = await putR2Object(key, body, data.contentType, data.filename);
    await upsertMediaAssetDirect(
      {
        key,
        url,
        filename: data.filename,
        originalFilename: data.originalFilename ?? data.filename,
        kind,
        mediaType: kind,
        contentType: data.contentType,
        size: body.byteLength,
        width: data.width,
        height: data.height,
        duration: data.duration,
        uploadDate: data.uploadDate,
        folder: data.folder,
      },
      { db },
    );
    return { url, key, size: body.byteLength, kind };
  });

export const listR2Objects = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => listR2ObjectsDirect());

// Deletes exactly one R2 object by key. Never expands by prefix or by any
// derived sibling — the caller must pass the precise key it wants gone.
// R2-only; no Supabase dependency.
export const deleteR2Object = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input) =>
    z
      .object({
        key: z.string().min(1).max(600),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = requireAdminDb(context);
    const cleanupReport = await buildStorageCleanupReport(db);
    if (!cleanupReport.lookupHealthy) {
      throw new Error(
        cleanupReport.deletionBlockedReason ?? "Storage cleanup lookup is unhealthy.",
      );
    }
    await deleteMediaAssetDirect({ key: data.key }, { db });
    return { ok: true, deleted: [data.key] };
  });

export const replaceR2Object = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input) =>
    z
      .object({
        key: z.string().min(1).max(600),
        contentType: z.string().max(160).optional().default("application/octet-stream"),
        dataBase64: z.string().min(1),
        backupKey: z.string().max(700).optional(),
        origBase64: z.string().optional(),
        origContentType: z.string().max(160).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = requireAdminDb(context);
    if (data.backupKey && data.origBase64) {
      await putR2Object(
        data.backupKey,
        b64ToBytes(data.origBase64),
        data.origContentType || data.contentType,
      );
    }
    const body = b64ToBytes(data.dataBase64);
    const url = await putR2Object(data.key, body, data.contentType);
    await upsertMediaAssetDirect(
      {
        key: data.key,
        url,
        filename: data.key.split("/").pop() ?? data.key,
        kind: inferKindFromContentType(data.contentType, data.key),
        contentType: data.contentType,
        size: body.byteLength,
      },
      { db },
    );
    return { ok: true, url, size: body.byteLength };
  });

/**
 * Orphan scanner — lists every object in R2 and marks whether the object URL
 * (or its key) is referenced anywhere in CMS content. Never deletes anything.
 */
export const scanStorageOrphans = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    const db = context?.supabase as AdminDb | undefined;
    if (!db) throw new Error("Admin database client unavailable");
    return buildStorageCleanupReport(db);
  });

// Legacy migration helper — kept for backward compatibility but marked as
// admin-only. Not used by the storage cleanup flow.
export const migrateSupabaseToR2 = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input) =>
    z
      .object({
        assets: z
          .array(
            z.object({
              url: z.string().url(),
              name: z.string().optional(),
              contentType: z.string().optional(),
            }),
          )
          .optional()
          .default([]),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { publicUrl } = await getR2Client();
    const existing = new Set((await listR2ObjectsDirect()).map((object) => object.key));
    const seenUrls = new Set<string>();
    let copied = 0;
    let skipped = 0;
    let failed = 0;
    const migrated: Array<{ from: string; to: string; key: string }> = [];

    for (const asset of data.assets) {
      if (seenUrls.has(asset.url) || asset.url.startsWith(`${publicUrl}/`)) {
        skipped++;
        continue;
      }
      seenUrls.add(asset.url);
      const kind = inferKindFromContentType(asset.contentType, asset.name || asset.url);
      const key = makeR2Key(kind, asset.name || asset.url.split("/").pop() || "asset.bin");
      const nextUrl = `${publicUrl}/${key}`;
      if (existing.has(key)) {
        skipped++;
        migrated.push({ from: asset.url, to: nextUrl, key });
        continue;
      }
      try {
        const res = await fetch(asset.url, { cache: "no-store" });
        if (!res.ok) throw new Error(`source fetch failed [${res.status}]`);
        const blob = await res.blob();
        const body = new Uint8Array(await blob.arrayBuffer());
        await putR2Object(
          key,
          body,
          asset.contentType || blob.type || res.headers.get("content-type") || undefined,
          asset.name,
        );
        copied++;
        existing.add(key);
        migrated.push({ from: asset.url, to: nextUrl, key });
      } catch (e) {
        console.error("R2 direct URL migration failed", asset.url, e);
        failed++;
      }
    }

    return {
      totalFiles: data.assets.length,
      copied,
      skipped,
      failed,
      rewrites: 0,
      migrated,
      message:
        migrated.length > 0
          ? "Files copied to R2. Replace old gallery/page references with the new R2 assets from the library where needed."
          : "R2 upload is active. No non-R2 assets were found to copy.",
    };
  });
