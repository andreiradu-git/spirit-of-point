// Anonymous Core Web Vitals collection (field data from real visits).
// Public endpoint. Stores route, metric, value, rating and device category only.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { deviceFromUserAgent, isBotUserAgent } from "./track";

const METRICS = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;

const schema = z.object({
  path: z.string().min(1).max(300),
  lang: z.enum(["en", "ro"]).optional(),
  metrics: z
    .array(
      z.object({
        metric: z.enum(METRICS),
        value: z.number().finite().nonnegative().max(3_600_000),
        rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
      }),
    )
    .min(1)
    .max(10),
});

export const Route = createFileRoute("/api/public/vitals")({
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
        if (!parsed.success) return Response.json({ ok: false, error: "invalid payload" }, { status: 400 });
        const { path, lang, metrics } = parsed.data;
        if (path.startsWith("/admin") || path.startsWith("/auth")) return Response.json({ ok: true, skipped: "admin" });

        const ua = request.headers.get("user-agent") ?? "";
        if (isBotUserAgent(ua)) return Response.json({ ok: true, skipped: "bot" });
        const device = deviceFromUserAgent(ua);

        const { d1Run, newId } = await import("@/lib/d1.server");
        const now = new Date().toISOString();
        try {
          for (const m of metrics) {
            await d1Run(
              `INSERT INTO web_vitals (id, path, lang, metric, value, rating, device, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                newId(),
                path,
                lang ?? (path === "/ro" || path.startsWith("/ro/") ? "ro" : "en"),
                m.metric,
                m.value,
                m.rating ?? null,
                device,
                now,
              ],
            );
          }
        } catch (error) {
          console.error("[vitals] insert failed", error);
          return Response.json({ ok: false, error: "storage unavailable" }, { status: 503 });
        }
        return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
