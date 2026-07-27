import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  b64ToBytes,
  deleteR2ObjectDirect,
  getR2Client,
  putR2Object,
} from "@/lib/r2.server";

// Replace the R2 object at `key` with new bytes. Optionally back up the
// existing bytes to `backupKey` (used by the optimizer to preserve originals).
export const replaceMediaObject = createServerFn({ method: "POST" })
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
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) throw new Error("Forbidden");

    if (data.backupKey && data.origBase64) {
      await putR2Object(
        data.backupKey,
        b64ToBytes(data.origBase64),
        data.origContentType || data.contentType,
      );
    }
    const body = b64ToBytes(data.dataBase64);
    const url = await putR2Object(data.key, body, data.contentType);
    return { ok: true, url, size: body.byteLength };
  });

// Delete an R2 object (and any legacy backup pair). Also removes gallery_images
// / asset_meta rows that pointed to the deleted object's public URL.
export const deleteMediaObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ key: z.string().min(1).max(600), alsoDeleteBackup: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) throw new Error("Forbidden");

    const { publicUrl } = await getR2Client();
    await deleteR2ObjectDirect(data.key);
    if (data.alsoDeleteBackup !== false) {
      try {
        await deleteR2ObjectDirect(`_originals/${data.key}`);
      } catch {
        /* backup may not exist — ignore */
      }
    }

    const objectUrl = `${publicUrl}/${data.key}`;
    await context.supabase.from("gallery_images").delete().eq("src", objectUrl);
    await context.supabase.from("asset_meta").delete().eq("url", objectUrl);
    return { ok: true };
  });
