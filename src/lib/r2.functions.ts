import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  b64ToBytes,
  deleteR2ObjectDirect,
  getR2Client,
  listR2ObjectsDirect,
  putR2Object,
  sanitizeFileName,
} from "@/lib/r2.server";

export type { R2Object } from "@/lib/r2.server";

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

export const migrateSupabaseToR2 = createServerFn({ method: "POST" }).handler(async () => {
  const { publicUrl } = getR2Client();
  const legacyUrlPrefixes = [
    process.env.LEGACY_MEDIA_PUBLIC_URL,
    process.env.VITE_SUPABASE_URL ? `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/media/` : undefined,
    process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/storage/v1/object/public/media/` : undefined,
  ].filter((v): v is string => Boolean(v));

  if (legacyUrlPrefixes.length === 0) {
    return {
      totalFiles: 0,
      copied: 0,
      skipped: 0,
      failed: 0,
      rewrites: 0,
      message:
        "R2 upload is active. Legacy migration needs a public legacy media URL prefix to discover old storage URLs, but no Supabase env is required for new uploads.",
    };
  }

  return {
    totalFiles: 0,
    copied: 0,
    skipped: 0,
    failed: 0,
    rewrites: 0,
    message: `R2 is configured at ${publicUrl}. Legacy storage copying is disabled in the Supabase-free asset flow; upload new files directly to R2 from Assets.`,
  };
});