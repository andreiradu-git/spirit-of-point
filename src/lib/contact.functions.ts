import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { getMediaDbClient } from "@/lib/media-assets.server";

type AnyDb = Omit<ReturnType<typeof getMediaDbClient>, "from"> & { from: (table: string) => any };

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  source_path: string | null;
  read_at: string | null;
  archived: boolean;
  created_at: string;
};

const submitSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().min(1).max(5000),
  source_path: z.string().max(500).optional(),
});

export const submitContactMessage = createServerFn({ method: "POST" })
  .validator((data) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const tag = "[contact]";
    try {
      console.log(`${tag} submitContactMessage called`, { data });

      const db = getMediaDbClient(false) as unknown as AnyDb;

      const payload = {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        subject: data.subject || null,
        message: data.message,
        source_path: data.source_path || null,
      };

      console.log(`${tag} inserting into contact_messages`, { payload });
      // Insert and request the returned row(s) when possible
      const insertRes = await db.from("contact_messages").insert(payload).select();
      console.log(`${tag} insert result`, insertRes);
      if (insertRes.error) {
        console.error(`${tag} insert failed`, insertRes.error);
        throw insertRes.error;
      }

      // No email sending logic present in repository; log and return success once DB insert succeeded.
      console.log(`${tag} insert succeeded, rows:`, insertRes.data);

      return { ok: true, rows: insertRes.data ?? null };
    } catch (e) {
      console.error("[contact] submitContactMessage error", e);
      // Never swallow errors — rethrow so client sees the failure.
      throw e;
    }
  });


export const listContactMessages = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    const db = context?.supabase as AnyDb | undefined;
    if (!db) throw new Error("Admin database client unavailable");
    const { data, error } = await db
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []) as ContactMessage[];
  });

export const updateContactMessage = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d) =>
    z.object({
      id: z.string().uuid(),
      read: z.boolean().optional(),
      archived: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context?.supabase as AnyDb | undefined;
    if (!db) throw new Error("Admin database client unavailable");
    const patch: { read_at?: string | null; archived?: boolean } = {};
    if (data.read !== undefined) patch.read_at = data.read ? new Date().toISOString() : null;
    if (data.archived !== undefined) patch.archived = data.archived;
    const { error } = await db.from("contact_messages").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteContactMessage = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context?.supabase as AnyDb | undefined;
    if (!db) throw new Error("Admin database client unavailable");
    const { error } = await db.from("contact_messages").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
