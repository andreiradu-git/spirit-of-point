import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serverDb, type ServerDb } from "@/lib/db-client.server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { readServerEnv } from "@/lib/server-env";

type AnyDb = Omit<ServerDb, "from"> & { from: (table: string) => any };

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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** Best-effort email notification through Resend; never blocks the submission. */
async function notifyByEmail(data: z.infer<typeof submitSchema>): Promise<void> {
  const apiKey = readServerEnv("RESEND_API_KEY");
  const to = readServerEnv("CONTACT_NOTIFY_EMAIL");
  if (!apiKey || !to) return;
  const from = readServerEnv("CONTACT_FROM_EMAIL") || "Point Studio <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: data.email,
      subject: `New message from ${data.name}${data.subject ? ` — ${data.subject}` : ""}`,
      html: `<h2>New contact message</h2>
        <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
        ${data.phone ? `<p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>` : ""}
        ${data.subject ? `<p><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>` : ""}
        <p>${escapeHtml(data.message).replace(/\n/g, "<br />")}</p>
        ${data.source_path ? `<p style="color:#888">Sent from ${escapeHtml(data.source_path)}</p>` : ""}`,
    }),
  });
  if (!res.ok) console.error("[contact] Resend notification failed", res.status, await res.text());
}

export const submitContactMessage = createServerFn({ method: "POST" })
  .validator((data) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const db = serverDb() as unknown as AnyDb;
    const insertRes = await db.from("contact_messages").insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      subject: data.subject || null,
      message: data.message,
      source_path: data.source_path || null,
    });
    if (insertRes.error) {
      console.error("[contact] insert failed", insertRes.error);
      throw new Error(insertRes.error.message);
    }

    try {
      await notifyByEmail(data);
    } catch (error) {
      console.error("[contact] notification error", error);
    }

    return { ok: true, rows: insertRes.data ?? null };
  });


export const listContactMessages = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    const db = serverDb() as unknown as AnyDb;
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
    const db = serverDb() as unknown as AnyDb;
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
    const db = serverDb() as unknown as AnyDb;
    const { error } = await db.from("contact_messages").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
