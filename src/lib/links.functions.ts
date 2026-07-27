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

    const { openaiChat, parseJsonLoose } = await import("./openai.server");

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

    const raw = await openaiChat({
      jsonMode: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const parsed = parseJsonLoose<{ title?: string; description?: string; category?: string }>(raw);
    return {
      title: (parsed.title ?? "").trim(),
      description: (parsed.description ?? "").trim(),
      category: (parsed.category ?? "other").trim().toLowerCase(),
    };
  });
