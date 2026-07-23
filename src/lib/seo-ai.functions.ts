import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KIND = z.enum(["seo", "alt"]);

export const generateSeoContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        kind: KIND,
        // For "seo": path + optional label. For "alt": imageUrl + optional context.
        path: z.string().optional(),
        label: z.string().optional(),
        imageUrl: z.string().url().optional(),
        context: z.string().optional(),
        extraKeywords: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Verify admin
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    let systemPrompt = "";
    let userPrompt = "";

    if (data.kind === "seo") {
      systemPrompt =
        "You write concise, high-converting SEO metadata for a professional photography studio (Point Studio, Bucharest). Return STRICT JSON only, no prose, no markdown, matching schema {\"title\":string,\"description\":string,\"keywords\":string}. Title <= 60 chars. Description 140-160 chars. Keywords: 8-14 comma-separated phrases, targeting Google and AI answer engines. Include locale (Bucharest / Romania) where natural.";
      userPrompt = `Page: ${data.label ?? data.path ?? "Home"} (${data.path ?? "/"}).\nExtra keyword hints: ${data.extraKeywords ?? "best professional photography, food photography, product photography, advertising, corporate, portrait, editorial, commercial photographer Bucharest"}.\nWrite metadata for this page.`;
    } else {
      systemPrompt =
        "You write descriptive, SEO-friendly alt text for photography portfolio images. Return STRICT JSON only, schema {\"alt\":string}. Alt text: 8-16 words, describes the visible subject, mood, lighting; no 'image of' prefix; include the category or brand when clear.";
      userPrompt = `Category / context: ${data.context ?? "photography"}. Image URL: ${data.imageUrl}. Write the alt text.`;
    }

    const messages: Array<{ role: string; content: unknown }> = [
      { role: "system", content: systemPrompt },
    ];
    if (data.kind === "alt" && data.imageUrl) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: data.imageUrl } },
        ],
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Plans & credits.");
      throw new Error(`AI error (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      // Try to extract JSON substring
      const match = raw.match(/\{[\s\S]*\}/);
      return match ? (JSON.parse(match[0]) as Record<string, string>) : {};
    }
  });
