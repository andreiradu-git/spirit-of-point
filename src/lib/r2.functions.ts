import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import {
  deleteMediaAssetDirect,
  getMediaDbClient,
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
  optimizedKeyFor,
  putR2Object,
  readR2ObjectDirect,
  sanitizeFileName,
  type AssetKind,
} from "@/lib/r2.server";

export type { R2Object } from "@/lib/r2.server";

const PUBLIC_URL = "https://images.pointstudio.ro";

type AdminDbQueryResult<T> = PromiseLike<{ data: T | null; error?: { message?: string } | null }>;
type AdminDb = {
  from: (table: string) => {
    select: <T = unknown>(...args: unknown[]) => AdminDbQueryResult<T>;
  };
};
type UploadWarning = { code: "metadata_persist_failed"; message: string };

function warningMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Metadata persistence failed";
}

function metadataWarning(error: unknown): UploadWarning {
  return {
    code: "metadata_persist_failed",
    message: warningMessage(error),
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
  .handler(async ({ data }) => {
    const warnings: UploadWarning[] = [];
    const results: Array<{ key: string; size: number; url: string }> = [];
    if (data.backup) {
      const body = b64ToBytes(data.backup.dataBase64);
      const url = await putR2Object(data.backup.key, body, data.backup.contentType);
      try {
        await upsertMediaAssetDirect({
          key: data.backup.key,
          url,
          filename: data.backup.key.split("/").pop() ?? data.backup.key,
          kind: inferKindFromContentType(data.backup.contentType, data.backup.key),
          contentType: data.backup.contentType,
          size: body.byteLength,
        });
      } catch (error) {
        warnings.push(metadataWarning(error));
      }
      results.push({ key: data.backup.key, size: body.byteLength, url });
    }
    const main = b64ToBytes(data.main.dataBase64);
    const mainUrl = await putR2Object(data.main.key, main, data.main.contentType);
    try {
      if (data.main.key.startsWith("optimized/")) {
        await markOptimizedMediaAssetDirect(data.main.key, mainUrl, main.byteLength);
      } else {
        await upsertMediaAssetDirect({
          key: data.main.key,
          url: mainUrl,
          filename: data.main.key.split("/").pop() ?? data.main.key,
          kind: inferKindFromContentType(data.main.contentType, data.main.key),
          contentType: data.main.contentType,
          size: main.byteLength,
        });
      }
    } catch (error) {
      warnings.push(metadataWarning(error));
    }
    results.push({ key: data.main.key, size: main.byteLength, url: mainUrl });
    for (const s of data.siblings) {
      const body = b64ToBytes(s.dataBase64);
      const url = await putR2Object(s.key, body, s.contentType);
      try {
        await upsertMediaAssetDirect({
          key: s.key,
          url,
          filename: s.key.split("/").pop() ?? s.key,
          kind: inferKindFromContentType(s.contentType, s.key),
          contentType: s.contentType,
          size: body.byteLength,
        });
      } catch (error) {
        warnings.push(metadataWarning(error));
      }
      results.push({ key: s.key, size: body.byteLength, url });
    }
    return { ok: true, results, warnings };
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
  // Legacy — ignored, kept for backward compatibility with existing callers.
  folder: z.string().max(120).optional(),
});

export const uploadToR2 = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input) => uploadSchema.parse(input))
  .handler(async ({ data }) => {
    const kind: AssetKind = data.kind ?? inferKindFromContentType(data.contentType, data.filename);
    const key = makeR2Key(kind, data.filename);
    const body = b64ToBytes(data.dataBase64);
    const url = await putR2Object(key, body, data.contentType, data.filename);
    const warnings: UploadWarning[] = [];
    try {
      await upsertMediaAssetDirect({
        key,
        url,
        filename: data.filename,
        kind,
        contentType: data.contentType,
        size: body.byteLength,
      });
    } catch (error) {
      warnings.push(metadataWarning(error));
    }
    return { url, key, size: body.byteLength, kind, warnings };
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
  .handler(async ({ data }) => {
    await deleteMediaAssetDirect({ key: data.key });
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
  .handler(async ({ data }) => {
    if (data.backupKey && data.origBase64) {
      await putR2Object(
        data.backupKey,
        b64ToBytes(data.origBase64),
        data.origContentType || data.contentType,
      );
    }
    const body = b64ToBytes(data.dataBase64);
    const url = await putR2Object(data.key, body, data.contentType);
    const warnings: UploadWarning[] = [];
    try {
      await upsertMediaAssetDirect({
        key: data.key,
        url,
        filename: data.key.split("/").pop() ?? data.key,
        kind: inferKindFromContentType(data.contentType, data.key),
        contentType: data.contentType,
        size: body.byteLength,
      });
    } catch (error) {
      warnings.push(metadataWarning(error));
    }
    return { ok: true, url, size: body.byteLength, warnings };
  });

/**
 * Orphan scanner — lists every object in R2 and marks whether the object URL
 * (or its key / optimized variant) is referenced anywhere in CMS content.
 * Never deletes anything.
 *
 * Matching strategy (in order):
 *   1. object_key / original URL
 *   2. optimized_object_key / optimized URL (derived via optimizedKeyFor)
 *   3. normalised filename stored in R2 customMetadata.originalName
 *
 * Reference sources checked:
 *   gallery_images, site_settings, pages, page_seo, media_assets, asset_meta,
 *   bundled data files (videos.json).
 */
export const scanStorageOrphans = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    const metadataIssues: string[] = [];
    let metadataHealthy = true;

    // Use the service-role DB client so RLS does not filter results.
    // Fall back gracefully if Supabase is not configured.
    type ScanDb = { from: (table: string) => { select: (...args: unknown[]) => PromiseLike<{ data: unknown[] | null; error?: { message?: string } | null }> } };
    let scanDb: ScanDb | undefined;
    try {
      scanDb = getMediaDbClient(true) as unknown as ScanDb;
    } catch (e) {
      metadataHealthy = false;
      metadataIssues.push(`DB client unavailable: ${warningMessage(e)}`);
    }

    const executeDbQueryWithFallback = async <T>(
      label: string,
      p?: PromiseLike<{ data: T | null; error?: { message?: string } | null }>,
    ): Promise<{ data: T | null }> => {
      if (!p) {
        metadataHealthy = false;
        metadataIssues.push(`${label}: Metadata unavailable`);
        return { data: null };
      }
      try {
        const result = await p;
        if (result?.error?.message) {
          metadataHealthy = false;
          metadataIssues.push(`${label}: ${result.error.message}`);
          return { data: result.data ?? null };
        }
        return { data: result?.data ?? null };
      } catch (e) {
        metadataHealthy = false;
        metadataIssues.push(`${label}: ${warningMessage(e)}`);
        console.warn("[storage-cleanup] CMS query failed, continuing:", e);
        return { data: null };
      }
    };

    const [objects, galleries, settings, pages, pageSeo, mediaAssets, assetMeta] = await Promise.all([
      listR2ObjectsDirect().catch((e) => {
        console.error("[storage-cleanup] R2 list failed", e);
        return [] as Awaited<ReturnType<typeof listR2ObjectsDirect>>;
      }),
      executeDbQueryWithFallback<Array<{ src?: string; gallery_id?: string }>>(
        "gallery_images",
        scanDb?.from("gallery_images").select("src, gallery_id") as PromiseLike<{ data: Array<{ src?: string; gallery_id?: string }> | null; error?: { message?: string } | null }> | undefined,
      ),
      executeDbQueryWithFallback<Array<{ key?: string; value?: unknown }>>(
        "site_settings",
        scanDb?.from("site_settings").select("key, value") as PromiseLike<{ data: Array<{ key?: string; value?: unknown }> | null; error?: { message?: string } | null }> | undefined,
      ),
      executeDbQueryWithFallback<Array<{ slug?: string; body?: unknown }>>(
        "pages",
        scanDb?.from("pages").select("slug, body") as PromiseLike<{ data: Array<{ slug?: string; body?: unknown }> | null; error?: { message?: string } | null }> | undefined,
      ),
      executeDbQueryWithFallback<Array<{ path?: string; og_image?: string }>>(
        "page_seo",
        scanDb?.from("page_seo").select("path, og_image") as PromiseLike<{ data: Array<{ path?: string; og_image?: string }> | null; error?: { message?: string } | null }> | undefined,
      ),
      // media_assets stores url + optimized_url for all tracked R2 objects.
      executeDbQueryWithFallback<Array<{ url?: string; optimized_url?: string; object_key?: string; optimized_object_key?: string }>>(
        "media_assets",
        scanDb?.from("media_assets").select("url, optimized_url, object_key, optimized_object_key") as PromiseLike<{ data: Array<{ url?: string; optimized_url?: string; object_key?: string; optimized_object_key?: string }> | null; error?: { message?: string } | null }> | undefined,
      ),
      // asset_meta is the legacy per-URL label/alt table — also check it for references.
      executeDbQueryWithFallback<Array<{ url?: string }>>(
        "asset_meta",
        scanDb?.from("asset_meta").select("url") as PromiseLike<{ data: Array<{ url?: string }> | null; error?: { message?: string } | null }> | undefined,
      ),
    ]);

    // Build one big haystack containing every referenced URL/string in the CMS.
    const haystackParts: string[] = [];
    const referenceIndex: Array<{ source: string; text: string }> = [];

    const addRef = (source: string, text: string) => {
      haystackParts.push(text);
      referenceIndex.push({ source, text });
    };

    for (const row of galleries.data ?? []) {
      if (row.src) addRef("gallery_images", row.src);
    }
    for (const row of settings.data ?? []) {
      const json = JSON.stringify(row.value ?? "");
      addRef(`site_settings:${row.key}`, json);
    }
    for (const row of pages.data ?? []) {
      const json = JSON.stringify(row.body ?? "");
      addRef(`page:${row.slug}`, json);
    }
    for (const row of pageSeo.data ?? []) {
      if (row.og_image) addRef(`page_seo:${row.path}`, row.og_image);
    }
    // media_assets: an object whose URL (original or optimized) appears here was explicitly
    // uploaded and tracked — it is not an orphan.
    for (const row of mediaAssets.data ?? []) {
      if (row.url) addRef("media_assets", row.url);
      if (row.optimized_url) addRef("media_assets", row.optimized_url);
      if (row.object_key) addRef("media_assets", row.object_key);
      if (row.optimized_object_key) addRef("media_assets", row.optimized_object_key);
    }
    for (const row of assetMeta.data ?? []) {
      if (row.url) addRef("asset_meta", row.url);
    }

    // Also include known bundled data files (videos list).
    try {
      const videos = (await import("@/data/videos.json")).default as Array<{ src: string }>;
      for (const v of videos) addRef("videos.json", v.src);
    } catch {
      /* optional */
    }

    const haystack = haystackParts.join("\n");

    let orphanBytes = 0;
    const report = objects.map((obj) => {
      if (!metadataHealthy) {
        return {
          key: obj.key,
          url: obj.url,
          size: obj.size,
          uploaded: obj.lastModified,
          contentType: obj.contentType,
          originalName: obj.originalName,
          referenced: null,
          referencedIn: [] as string[],
          status: "metadata-unavailable" as const,
          orphanReason: undefined as string | undefined,
        };
      }

      // Compute the paired optimized key/url for this object (if applicable).
      const isOptimized = obj.key.startsWith("optimized/");
      const pairedOptimizedKey = isOptimized ? null : optimizedKeyFor(obj.key);
      const pairedOptimizedUrl = pairedOptimizedKey ? `${PUBLIC_URL}/${pairedOptimizedKey}` : null;

      // Collect all identifiers to probe — original + optimized + filename.
      const probes: string[] = [obj.url, obj.key];
      if (pairedOptimizedUrl) probes.push(pairedOptimizedUrl);
      if (pairedOptimizedKey) probes.push(pairedOptimizedKey);
      if (obj.originalName) probes.push(obj.originalName);

      const matchedSources = referenceIndex.filter((r) => probes.some((p) => r.text.includes(p)));
      const referenced = matchedSources.length > 0;
      const referencedIn = referenced
        ? Array.from(new Set(matchedSources.map((r) => r.source)))
        : [];

      let orphanReason: string | undefined;
      if (!referenced) {
        orphanBytes += obj.size;
        orphanReason = `Not found in any CMS table. Checked: original URL (${obj.url}), key (${obj.key})${pairedOptimizedUrl ? `, optimized URL (${pairedOptimizedUrl})` : ""}${obj.originalName ? `, filename (${obj.originalName})` : ""}.`;
      }

      return {
        key: obj.key,
        url: obj.url,
        size: obj.size,
        uploaded: obj.lastModified,
        contentType: obj.contentType,
        originalName: obj.originalName,
        referenced,
        referencedIn,
        status: referenced ? ("referenced" as const) : ("orphan" as const),
        orphanReason,
      };
    });

    return {
      bucketPublicUrl: PUBLIC_URL,
      totalObjects: report.length,
      totalBytes: report.reduce((n, r) => n + r.size, 0),
      orphanCount: metadataHealthy ? report.filter((r) => r.status === "orphan").length : null,
      orphanBytes: metadataHealthy ? orphanBytes : null,
      scannedAt: new Date().toISOString(),
      metadataStatus: metadataHealthy ? "healthy" : "Metadata unavailable",
      metadataHealthy,
      metadataIssues,
      deletionEnabled: true,
      objects: report,
    };
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
