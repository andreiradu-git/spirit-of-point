import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateLinkMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        url: z.string().url(),
        context: z.string().max(400).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    // Best-effort fetch of page title/description for context.
    let pageInfo = "";
    try {
      const r = await fetch(data.url, {
        headers: { "User-Agent": "Mozilla/5.0 PointStudioBot/1.0" },
        signal: AbortSignal.timeout(6000),
      });
      const html = (await r.text()).slice(0, 12000);
      const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "";
      const desc =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
        "";
      pageInfo = `Page title: ${title}\nPage description: ${desc}`.slice(0, 800);
    } catch {
      pageInfo = "";
    }

    const system =
      'You write link metadata for the Point Studio (Bucharest photo/video studio) website. Return STRICT JSON only: {"title": string, "description": string, "category": string}. title: 2-6 word display label. description: 1 short sentence. category: one of "social", "portfolio", "press", "shop", "resource", "other". No markdown.';
    const user = `URL: ${data.url}\nContext: ${data.context ?? "external link"}\n${pageInfo}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("Rate limit — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Plans & credits.");
      throw new Error(`AI error (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { title?: string; description?: string; category?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    return {
      title: (parsed.title ?? "").trim(),
      description: (parsed.description ?? "").trim(),
      category: (parsed.category ?? "other").trim().toLowerCase(),
    };
  });
