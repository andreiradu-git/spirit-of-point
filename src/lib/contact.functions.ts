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

/** Public, secret-free view of the notification configuration (used by /api/debug/email). */
export function contactEmailConfigStatus() {
  const apiKey = readServerEnv("RESEND_API_KEY");
  const to = readServerEnv("CONTACT_NOTIFY_EMAIL");
  const from = readServerEnv("CONTACT_FROM_EMAIL");
  return {
    provider: "resend",
    hasApiKey: Boolean(apiKey),
    apiKeyLooksValid: Boolean(apiKey?.startsWith("re_")),
    hasRecipient: Boolean(to),
    recipientDomain: to?.split("@")[1] ?? null,
    hasFromOverride: Boolean(from),
    fromDomain: (from ?? "onboarding@resend.dev").split("@").pop()?.replace(/>$/, "") ?? null,
    usingResendTestSender: !from,
    ready: Boolean(apiKey && to),
  };
}

/**
 * Notification email through Resend. Never blocks or reverts the stored message.
 * Returns a structured result so the handler can log precisely why a send did not happen.
 */
async function notifyByEmail(
  data: z.infer<typeof submitSchema>,
  idempotencyKey: string,
): Promise<{ sent: boolean; reason?: string; id?: string }> {
  const apiKey = readServerEnv("RESEND_API_KEY");
  const to = readServerEnv("CONTACT_NOTIFY_EMAIL");
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY is not set in the Worker environment" };
  if (!to) return { sent: false, reason: "CONTACT_NOTIFY_EMAIL is not set in the Worker environment" };

  // Authenticated sender on our own domain. The visitor's address is only ever
  // used as Reply-To so SPF/DMARC stay intact.
  const from = readServerEnv("CONTACT_FROM_EMAIL") || "Point Studio <onboarding@resend.dev>";

  const rows: Array<[string, string | undefined]> = [
    ["Name", data.name],
    ["Email", data.email],
    ["Phone", data.phone || undefined],
    ["Subject", data.subject || undefined],
    ["Sent from", data.source_path || undefined],
  ];

  const html = `<h2 style="font-family:Georgia,serif">New website inquiry — Point Studio</h2>
    <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
      ${rows
        .filter(([, v]) => Boolean(v))
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td style="padding:4px 0"><strong>${escapeHtml(v!)}</strong></td></tr>`,
        )
        .join("")}
    </table>
    <p style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap;margin-top:16px">${escapeHtml(
      data.message,
    ).replace(/\n/g, "<br />")}</p>`;

  const text = [
    ...rows.filter(([, v]) => Boolean(v)).map(([k, v]) => `${k}: ${v}`),
    "",
    data.message,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Guarantees one email per stored submission even if the request is retried.
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: data.email,
      subject: `New website inquiry - Point Studio${data.subject ? ` — ${data.subject}` : ""}`,
      html,
      text,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    return { sent: false, reason: `Resend responded ${res.status}: ${body}` };
  }
  let id: string | undefined;
  try {
    id = (JSON.parse(body) as { id?: string }).id;
  } catch {
    /* non-JSON success body */
  }
  return { sent: true, id };
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

    // The stored message is authoritative; notification failures are logged only.
    try {
      const key = `contact-${data.email}-${Date.now()}`;
      const result = await notifyByEmail(data, key);
      if (result.sent) console.info("[contact] notification sent", { id: result.id });
      else console.error("[contact] notification NOT sent:", result.reason);
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
