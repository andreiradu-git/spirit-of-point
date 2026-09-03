// Anonymous first-party page-view collection.
// Public endpoint: the browser posts a minimal payload; the Worker derives
// device category, country and city from the request itself. No IP address,
// no user-agent string and no fingerprint is ever stored.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  path: z.string().min(1).max(300),
  lang: z.enum(["en", "ro"]).optional(),
  referrer: z.string().max(600).optional().nullable(),
  sessionId: z.string().max(64).optional().nullable(),
  searchQuery: z.string().max(200).optional().nullable(),
});

const BOT = /bot|crawler|spider|crawling|preview|headless|lighthouse|pingdom|monitor|curl|wget|python-requests|facebookexternalhit|slackbot|whatsapp|bingpreview/i;

export function deviceFromUserAgent(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return "mobile";
  return "desktop";
}

export function isBotUserAgent(ua: string): boolean {
  return !ua || BOT.test(ua);
}

export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "invalid payload" }, { status: 400 });
        }
        const data = parsed.data;

        // Never record admin surfaces.
        if (data.path.startsWith("/admin") || data.path.startsWith("/auth") || data.path.startsWith("/api")) {
          return Response.json({ ok: true, skipped: "admin" });
        }

        const ua = request.headers.get("user-agent") ?? "";
        if (isBotUserAgent(ua)) return Response.json({ ok: true, skipped: "bot" });
        // Speculation-rules / <link rel=prefetch> requests must not count.
        const purpose = request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "";
        if (/prefetch|prerender/i.test(purpose)) return Response.json({ ok: true, skipped: "prefetch" });

        const { d1Run, newId } = await import("@/lib/d1.server");
        const cf = (request as Request & { cf?: { country?: string; city?: string } }).cf;
        const country = cf?.country ?? request.headers.get("cf-ipcountry") ?? null;
        const city = cf?.city ?? null;

        try {
          await d1Run(
            `INSERT INTO page_views (id, path, referrer, user_agent, session_id, country, city, search_query, lang, device, created_at)
             VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
            [
              newId(),
              data.path,
              data.referrer || null,
              data.sessionId || null,
              country,
              city,
              data.searchQuery || null,
              data.lang ?? (data.path === "/ro" || data.path.startsWith("/ro/") ? "ro" : "en"),
              deviceFromUserAgent(ua),
              new Date().toISOString(),
            ],
          );
        } catch (error) {
          console.error("[track] page view insert failed", error);
          return Response.json({ ok: false, error: "storage unavailable" }, { status: 503 });
        }
        return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
