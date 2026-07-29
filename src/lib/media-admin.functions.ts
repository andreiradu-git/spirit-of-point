import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { deleteMediaAssetDirect, upsertMediaAssetDirect } from "@/lib/media-assets.server";
import {
  b64ToBytes,
  putR2Object,
  inferKindFromContentType,
} from "@/lib/r2.server";

// Replace the R2 object at `key` with new bytes. Optionally back up the
// existing bytes to `backupKey` (used by the optimizer to preserve originals).
export const replaceMediaObject = createServerFn({ method: "POST" })
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

// Delete an R2 object (and any legacy backup pair). Also removes gallery_images
// / asset_meta rows that pointed to the deleted object's public URL.
export const deleteMediaObject = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input) =>
    z.object({ key: z.string().min(1).max(600), alsoDeleteBackup: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    await deleteMediaAssetDirect({ key: data.key });
    return { ok: true };
  });
