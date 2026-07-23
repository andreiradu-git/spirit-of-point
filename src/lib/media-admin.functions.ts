import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ReplaceInput = {
  path: string;
  contentType: string;
  dataBase64: string;
  backupPath?: string;
  origBase64?: string;
  origContentType?: string;
  cacheControl?: string;
};

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const replaceMediaObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReplaceInput) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cacheControl = data.cacheControl ?? "31536000";

    if (data.backupPath && data.origBase64) {
      const orig = b64ToBytes(data.origBase64);
      // Ignore "already exists" — first backup wins.
      await supabaseAdmin.storage
        .from("media")
        .upload(data.backupPath, orig, {
          contentType: data.origContentType,
          upsert: false,
          cacheControl,
        });
    }

    const body = b64ToBytes(data.dataBase64);
    const { error } = await supabaseAdmin.storage
      .from("media")
      .update(data.path, body, {
        contentType: data.contentType,
        upsert: true,
        cacheControl,
      });
    if (error) throw new Error(error.message);
    return { ok: true, size: body.byteLength };
  });

export const deleteMediaObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string; alsoDeleteBackup?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const toDelete = [data.path];
    if (data.alsoDeleteBackup !== false) toDelete.push(`_originals/${data.path}`);
    const { error } = await supabaseAdmin.storage.from("media").remove(toDelete);
    if (error) throw new Error(error.message);

    // Also remove any gallery_images rows that reference the public URL of this object.
    const publicUrl = supabaseAdmin.storage.from("media").getPublicUrl(data.path).data.publicUrl;
    await supabaseAdmin.from("gallery_images").delete().eq("src", publicUrl);
    await supabaseAdmin.from("asset_meta").delete().eq("url", publicUrl);
    return { ok: true };
  });

