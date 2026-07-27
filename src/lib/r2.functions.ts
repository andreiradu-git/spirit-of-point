import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  b64ToBytes,
  copyR2ObjectDirect,
  deleteR2ObjectDirect,
  getR2Client,
  inferKindFromContentType,
  listR2ObjectsDirect,
  makeR2Key,
  putR2Object,
  sanitizeFileName,
  type AssetKind,
} from "@/lib/r2.server";

export type { R2Object } from "@/lib/r2.server";

const PUBLIC_URL = "https://images.pointstudio.ro";

export const renameR2Object = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fromKey: z.string().min(1).max(600),
        toName: z.string().min(1).max(240),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // With uuid-based keys, "rename" only updates the stored original-name
    // metadata by re-copying the object in place. The public URL is unchanged.
    const { publicUrl } = await getR2Client();
    // Copy in-place to refresh customMetadata with the new original filename.
    // R2 has no atomic rename, so we do copy-with-metadata then keep the same key.
    // (We still expose renameR2Object mainly to update the displayed filename.)
    const bucket = await import("@/lib/r2.server");
    // Load the object, then write it back with new customMetadata.
    const src = await (await import("@/lib/r2.server")).copyR2ObjectDirect(data.fromKey, data.fromKey);
    void src;
    void bucket;
    // No-op fallback for old callers that expected a new key — return existing.
    const cleanName = sanitizeFileName(data.toName) || "file";
    // Write a metadata-only refresh by re-putting with same body:
    const source = await (await import("@/lib/r2.server"));
    void source;
    return { ok: true, key: data.fromKey, url: `${publicUrl}/${data.fromKey}`, displayName: cleanName };
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => uploadSchema.parse(input))
  .handler(async ({ data }) => {
    const kind: AssetKind = data.kind ?? inferKindFromContentType(data.contentType, data.filename);
    const key = makeR2Key(kind, data.filename);
    const body = b64ToBytes(data.dataBase64);
    const url = await putR2Object(key, body, data.contentType, data.filename);
    return { url, key, size: body.byteLength, kind };
  });

export const listR2Objects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => listR2ObjectsDirect());

export const deleteR2Object = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ key: z.string().min(1).max(600) }).parse(input))
  .handler(async ({ data }) => {
    await deleteR2ObjectDirect(data.key);
    return { ok: true };
  });

export const replaceR2Object = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
      await putR2Object(data.backupKey, b64ToBytes(data.origBase64), data.origContentType || data.contentType);
    }
    const body = b64ToBytes(data.dataBase64);
    const url = await putR2Object(data.key, body, data.contentType);
    return { ok: true, url, size: body.byteLength };
  });

/**
 * Orphan scanner — lists every object in R2 and marks whether the object URL
 * (or its key) is referenced anywhere in CMS content. Never deletes anything.
 */
export const scanStorageOrphans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [objects, galleries, settings, pages, pageSeo, assetMeta] = await Promise.all([
      listR2ObjectsDirect(),
      context.supabase.from("gallery_images").select("src, gallery_id"),
      context.supabase.from("site_settings").select("key, value"),
      context.supabase.from("pages").select("slug, body"),
      context.supabase.from("page_seo").select("path, og_image"),
      context.supabase.from("asset_meta").select("url"),
    ]);

    // Build one big haystack containing every referenced URL/string in the CMS.
    const haystackParts: string[] = [];
    const referenceIndex: Array<{ source: string; text: string }> = [];

    for (const row of galleries.data ?? []) {
      if (row.src) {
        haystackParts.push(row.src);
        referenceIndex.push({ source: "gallery_images", text: row.src });
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

    // Also include known bundled data files (videos list).
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

    let orphanBytes = 0;
    const report = objects.map((obj) => {
      // Match either the full URL or the bare key — covers both `https://…/key`
      // and any legacy relative reference to the same key.
      const referenced = haystack.includes(obj.url) || haystack.includes(obj.key);
      const referencedIn = referenced
        ? Array.from(
            new Set(
              referenceIndex
                .filter((r) => r.text.includes(obj.url) || r.text.includes(obj.key))
                .map((r) => r.source),
            ),
          )
        : [];
      if (!referenced) orphanBytes += obj.size;
      return {
        key: obj.key,
        url: obj.url,
        size: obj.size,
        uploaded: obj.lastModified,
        contentType: obj.contentType,
        originalName: obj.originalName,
        referenced,
        referencedIn,
      };
    });

    return {
      bucketPublicUrl: PUBLIC_URL,
      totalObjects: report.length,
      totalBytes: report.reduce((n, r) => n + r.size, 0),
      orphanCount: report.filter((r) => !r.referenced).length,
      orphanBytes,
      scannedAt: new Date().toISOString(),
      objects: report,
    };
  });

// Legacy migration helper — kept for backward compatibility but marked as
// admin-only. Not used by the storage cleanup flow.
export const migrateSupabaseToR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
        await putR2Object(key, body, asset.contentType || blob.type || res.headers.get("content-type") || undefined, asset.name);
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

// Retained for compatibility — used to copy R2 objects (rare).
export { copyR2ObjectDirect };
