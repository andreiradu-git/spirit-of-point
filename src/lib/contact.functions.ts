import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
    const { readServerEnv } = await import("@/lib/server-env");
    const url = readServerEnv("SUPABASE_URL") ?? readServerEnv("VITE_SUPABASE_URL");
    const key =
      readServerEnv("SUPABASE_PUBLISHABLE_KEY") ??
      readServerEnv("SUPABASE_ANON_KEY") ??
      readServerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
    if (!url || !key) {
      // Return an HTTP 500 Response so monitoring sees a server error instead of a 200 with an error body
      throw new Response(JSON.stringify({ message: "Contact form is temporarily unavailable — the site backend is not configured. Please email us directly." }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.from("contact_messages").insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      subject: data.subject || null,
      message: data.message,
      source_path: data.source_path || null,
    });
    if (error) throw error;
    return { ok: true };
  });


export const listContactMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data ?? [];
  });

export const updateContactMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({
      id: z.string().uuid(),
      read: z.boolean().optional(),
      archived: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: { read_at?: string | null; archived?: boolean } = {};
    if (data.read !== undefined) patch.read_at = data.read ? new Date().toISOString() : null;
    if (data.archived !== undefined) patch.archived = data.archived;
    const { error } = await context.supabase.from("contact_messages").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteContactMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("contact_messages").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
