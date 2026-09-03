import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serverDb } from "@/lib/db-client.server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { deleteMediaAssetDirect, upsertMediaAssetDirect } from "@/lib/media-assets.server";
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

type AdminDb = { from: (table: string) => any };

// R2-only image and media storage. Public image variants are generated on
// demand by Cloudflare Image Transformations, never by this Worker.


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
    return { ok: true, key: data.fromKey, url: `${PUBLIC_URL}/${data.fromKey}`, displayName: clean };
  });

const uploadSchema = z.object({
  filename: z.string().min(1).max(240),
  contentType: z.string().max(160).optional().default("application/octet-stream"),
  dataBase64: z.string().min(1),
  kind: z.enum(["image", "video", "file"]).optional(),
  width: z.number().int().positive().max(50000).optional(),
  height: z.number().int().positive().max(50000).optional(),
  originalObjectKey: z.string().min(1).max(700).optional(),
  originalUrl: z.string().url().max(1000).optional(),
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
    await upsertMediaAssetDirect({
      key,
      url,
      filename: data.filename,
      kind,
      contentType: data.contentType,
      size: body.byteLength,
      width: data.width,
      height: data.height,
      originalObjectKey: data.originalObjectKey,
      originalUrl: data.originalUrl,
    });
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
  .handler(async ({ data }) => {
    // Fresh server-side re-check: never trust the classification the browser saw.
    // Anything still referenced, or any archival master, is refused outright.
    const report = await buildStorageReport();
    const entry = report.objects.find((o) => o.key === data.key);
    if (!entry) return { ok: false, deleted: [], reason: "not-found" as const };
    if (entry.protected)
      return { ok: false, deleted: [], reason: "archival-master-protected" as const };
    if (entry.referenced) return { ok: false, deleted: [], reason: "still-referenced" as const };
    await deleteMediaAssetDirect({ key: data.key });
    return { ok: true, deleted: [data.key], reason: "deleted" as const };
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
      await putR2Object(data.backupKey, b64ToBytes(data.origBase64), data.origContentType || data.contentType);
    }
    const body = b64ToBytes(data.dataBase64);
    const url = await putR2Object(data.key, body, data.contentType);
    await upsertMediaAssetDirect({
      key: data.key,
      url,
      filename: data.key.split("/").pop() ?? data.key,
      kind: inferKindFromContentType(data.contentType, data.key),
      contentType: data.contentType,
      size: body.byteLength,
    });
    return { ok: true, url, size: body.byteLength };
  });


/**
 * Orphan scanner — lists every object in R2 and marks whether the object URL
 * (or its key) is referenced anywhere in CMS content. Never deletes anything.
 */
/** Read-only audit of every R2 object against every CMS and static reference. */
async function buildStorageReport() {
    const db = serverDb() as unknown as AdminDb;
    const safe = async <T,>(p: PromiseLike<{ data: T | null }>): Promise<{ data: T | null }> => {
      try {
        return await p;
      } catch (e) {
        console.warn("[storage-cleanup] CMS query failed, continuing:", e);
        return { data: null };
      }
    };
    const [objects, galleries, settings, pages, pageSeo, assetMeta, mediaAssets] = await Promise.all([
      listR2ObjectsDirect().catch((e) => {
        console.error("[storage-cleanup] R2 list failed", e);
        return [] as Awaited<ReturnType<typeof listR2ObjectsDirect>>;
      }),
      safe<Array<{ src?: string; gallery_id?: string }>>(db.from("gallery_images").select("src, gallery_id")),
      safe<Array<{ key?: string; value?: unknown }>>(db.from("site_settings").select("key, value")),
      safe<Array<{ slug?: string; body?: unknown }>>(db.from("pages").select("slug, body")),
      safe<Array<{ path?: string; og_image?: string }>>(db.from("page_seo").select("path, og_image")),
      safe<Array<{ url?: string }>>(db.from("asset_meta").select("url")),
      safe<Array<{ object_key?: string; optimized_object_key?: string; original_object_key?: string; url?: string; optimized_url?: string; original_url?: string }>>(
        db.from("media_assets").select("object_key, optimized_object_key, original_object_key, url, optimized_url, original_url"),
      ),
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
    for (const row of mediaAssets.data ?? []) {
      for (const value of [row.object_key, row.optimized_object_key, row.original_object_key, row.url, row.optimized_url, row.original_url]) {
        if (value) {
          haystackParts.push(value);
          referenceIndex.push({ source: "media_assets", text: value });
        }
      }
    }

    // Bundled/static content counts as a reference too: the seed JSON files under
    // src/data are shipped with the app and still render when D1 has no override.
    const staticData = import.meta.glob("../data/**/*.json", { eager: true }) as Record<
      string,
      { default: unknown }
    >;
    for (const [file, mod] of Object.entries(staticData)) {
      const json = JSON.stringify(mod.default ?? "");
      haystackParts.push(json);
      referenceIndex.push({ source: `static:${file.replace("../data/", "")}`, text: json });
    }

    const haystack = haystackParts.join("\n");

    // Archival masters: any key a media_assets row points at as its untouched
    // original. These are never deletable, whatever the reference scan says.
    const protectedKeys = new Set<string>();
    for (const row of mediaAssets.data ?? []) {
      for (const value of [row.original_object_key, row.original_url]) {
        if (value) protectedKeys.add(value.split("/").slice(-2).join("/"));
      }
    }

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
      const isProtected = protectedKeys.has(obj.key);
      const legacyOptimized = obj.key.startsWith("optimized/");
      const category: StorageCategory = isProtected
        ? "archival-master"
        : referenced
          ? legacyOptimized
            ? "legacy-optimized-referenced"
            : "active"
          : legacyOptimized
            ? "legacy-optimized-unreferenced"
            : "unreferenced";
      if (!referenced && !isProtected) orphanBytes += obj.size;
      return {
        key: obj.key,
        url: obj.url,
        size: obj.size,
        uploaded: obj.lastModified,
        contentType: obj.contentType,
        originalName: obj.originalName,
        referenced,
        referencedIn,
        protected: isProtected,
        category,
      };
    });

    // Broken references: something in the CMS points at a key R2 no longer holds.
    const presentKeys = new Set(objects.map((o) => o.key));
    const missing: Array<{ key: string; source: string }> = [];
    const seenMissing = new Set<string>();
    for (const ref of referenceIndex) {
      for (const match of ref.text.matchAll(/(originals|optimized|uploads|media)\/[A-Za-z0-9._-]+/g)) {
        const key = match[0];
        if (presentKeys.has(key)) continue;
        const dedupe = `${ref.source}|${key}`;
        if (seenMissing.has(dedupe)) continue;
        seenMissing.add(dedupe);
        missing.push({ key, source: ref.source });
      }
    }

    const byCategory = report.reduce<Record<string, { count: number; bytes: number }>>((acc, r) => {
      const slot = (acc[r.category] ??= { count: 0, bytes: 0 });
      slot.count += 1;
      slot.bytes += r.size;
      return acc;
    }, {});

    return {
      bucketPublicUrl: PUBLIC_URL,
      totalObjects: report.length,
      totalBytes: report.reduce((n, r) => n + r.size, 0),
      orphanCount: report.filter((r) => !r.referenced && !r.protected).length,
      orphanBytes,
      byCategory,
      missingReferences: missing.slice(0, 200),
      scannedAt: new Date().toISOString(),
      objects: report,
    };
}

export const scanStorageOrphans = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => buildStorageReport());

export type StorageCategory =
  | "active"
  | "archival-master"
  | "legacy-optimized-referenced"
  | "legacy-optimized-unreferenced"
  | "unreferenced";

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
