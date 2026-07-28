import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import {
  deleteMediaAssetDirect,
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

function ensureString(value: unknown, name: string, location = "src/lib/r2.functions.ts") {
  if (typeof value !== "string") {
    console.error(`[${location}] ${name} is not a string`, value);
    throw new Response(
      JSON.stringify({ message: `${name} is required and must be a string` }),
      { status: 400, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }
  return value;
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
    const results: Array<{ key: string; size: number; url: string }> = [];
    if (data.backup) {
      const body = b64ToBytes(data.backup.dataBase64);
      // defensive checks and logging
      const bkKey = ensureString(data.backup.key, "backup.key", "writeR2Variants");
      const bkContentType = ensureString(data.backup.contentType, "backup.contentType", "writeR2Variants");
      const url = await putR2Object(bkKey, body, bkContentType);
      await upsertMediaAssetDirect({
        key: bkKey,
        url,
        filename: bkKey.split("/").pop() ?? bkKey,
        kind: inferKindFromContentType(bkContentType, bkKey),
        contentType: bkContentType,
        size: body.byteLength,
      });
      results.push({ key: bkKey, size: body.byteLength, url });
    }
    const mainData = data.main;
    const mainBody = b64ToBytes(mainData.dataBase64);
    const mainKey = ensureString(mainData.key, "main.key", "writeR2Variants");
    const mainContentType = ensureString(mainData.contentType, "main.contentType", "writeR2Variants");
    const mainUrl = await putR2Object(mainKey, mainBody, mainContentType);
    if (mainKey.startsWith("optimized/")) {
      await markOptimizedMediaAssetDirect(mainKey, mainUrl, mainBody.byteLength);
    } else {
      await upsertMediaAssetDirect({
        key: mainKey,
        url: mainUrl,
        filename: mainKey.split("/").pop() ?? mainKey,
        kind: inferKindFromContentType(mainContentType, mainKey),
        contentType: mainContentType,
        size: mainBody.byteLength,
      });
    }
    results.push({ key: mainKey, size: mainBody.byteLength, url: mainUrl });
    for (const s of data.siblings) {
      const body = b64ToBytes(s.dataBase64);
      const skey = ensureString(s.key, "sibling.key", "writeR2Variants");
      const scontent = ensureString(s.contentType, "sibling.contentType", "writeR2Variants");
      const url = await putR2Object(skey, body, scontent);
      await upsertMediaAssetDirect({
        key: skey,
        url,
        filename: skey.split("/").pop() ?? skey,
        kind: inferKindFromContentType(scontent, skey),
        contentType: scontent,
        size: body.byteLength,
      });
      results.push({ key: skey, size: body.byteLength, url });
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
    return { ok: true, key: data.fromKey, url: `${PUBLIC_URL}/${data.fromKey}`, displayName: clean };
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
    // Defensive checks: ensure filename and contentType are strings
    const filename = ensureString(data.filename, "filename", "uploadToR2");
    const contentType = ensureString(data.contentType, "contentType", "uploadToR2");

    const kind: AssetKind = data.kind ?? inferKindFromContentType(contentType, filename);
    const key = makeR2Key(kind, filename);
    const body = b64ToBytes(data.dataBase64);
    const url = await putR2Object(key, body, contentType, filename);
    await upsertMediaAssetDirect({ key, url, filename, kind, contentType, size: body.byteLength });
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
      await putR2Object(data.backupKey, b64ToBytes(data.origBase64), data.origContentType || data.contentType);
    }
    const body = b64ToBytes(data.dataBase64);
    const url = await putR2Object(data.key, body, data.contentType);
    const safeKey = ensureString(data.key, "key", "replaceR2Object");
    await upsertMediaAssetDirect({
      key: safeKey,
      url,
      filename: safeKey.split("/").pop() ?? safeKey,
      kind: inferKindFromContentType(data.contentType, safeKey),
      contentType: data.contentType,
      size: body.byteLength,
    });
    return { ok: true, url, size: body.byteLength };
  });
