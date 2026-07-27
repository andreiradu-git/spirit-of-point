import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  b64ToBytes,
  copyR2ObjectDirect,
  deleteR2ObjectDirect,
  getR2Client,
  listR2ObjectsDirect,
  putR2Object,
  sanitizeFileName,
} from "@/lib/r2.server";

export type { R2Object } from "@/lib/r2.server";

export const renameR2Object = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        fromKey: z.string().min(1).max(600),
        toName: z.string().min(1).max(240),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { publicUrl } = getR2Client();
    const folder = data.fromKey.includes("/")
      ? data.fromKey.slice(0, data.fromKey.lastIndexOf("/"))
      : "";
    const ext = (data.toName.split(".").pop() || data.fromKey.split(".").pop() || "bin").toLowerCase();
    const base = sanitizeFileName(data.toName.replace(/\.[^.]+$/, "")) || "file";
    const toKey = `${folder ? folder + "/" : ""}${base}.${ext}`;
    if (toKey === data.fromKey) return { ok: true, key: toKey, url: `${publicUrl}/${toKey}` };
    const url = await copyR2ObjectDirect(data.fromKey, toKey);
    await deleteR2ObjectDirect(data.fromKey);
    return { ok: true, key: toKey, url };
  });


export const uploadToR2 = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        filename: z.string().min(1).max(240),
        contentType: z.string().max(160).optional().default("application/octet-stream"),
        dataBase64: z.string().min(1),
        folder: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ext = (data.filename.split(".").pop() || "bin").toLowerCase();
    const base = sanitizeFileName(data.filename.replace(/\.[^.]+$/, "")) || "file";
    const folder = (data.folder || "uploads").replace(/^\/+|\/+$/g, "") || "uploads";
    const key = `${folder}/${base}-${Date.now()}.${ext}`;
    const body = b64ToBytes(data.dataBase64);
    const url = await putR2Object(key, body, data.contentType);
    return { url, key, size: body.byteLength };
  });

export const listR2Objects = createServerFn({ method: "GET" }).handler(async () => listR2ObjectsDirect());

export const deleteR2Object = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ key: z.string().min(1).max(600) }).parse(input))
  .handler(async ({ data }) => {
    await deleteR2ObjectDirect(data.key);
    return { ok: true };
  });

export const replaceR2Object = createServerFn({ method: "POST" })
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

export const migrateSupabaseToR2 = createServerFn({ method: "POST" })
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
    const { publicUrl } = getR2Client();
    const existing = new Set((await listR2ObjectsDirect()).map((object) => object.key));
    const seenUrls = new Set<string>();
    let copied = 0;
    let skipped = 0;
    let failed = 0;
    const migrated: Array<{ from: string; to: string; key: string }> = [];

    const makeKey = (assetUrl: string, name?: string) => {
      const url = new URL(assetUrl);
      const decodedPath = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      const mediaMarker = "storage/v1/object/public/media/";
      if (decodedPath.includes(mediaMarker)) {
        return decodedPath.slice(decodedPath.indexOf(mediaMarker) + mediaMarker.length);
      }
      const rawName = name || decodedPath.split("/").pop() || "asset";
      const clean = sanitizeFileName(rawName) || `asset-${Date.now()}`;
      return `migrated/${clean}`;
    };

    for (const asset of data.assets) {
      if (seenUrls.has(asset.url) || asset.url.startsWith(`${publicUrl}/`)) {
        skipped++;
        continue;
      }
      seenUrls.add(asset.url);
      const key = makeKey(asset.url, asset.name);
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
        await putR2Object(key, body, asset.contentType || blob.type || res.headers.get("content-type") || undefined);
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