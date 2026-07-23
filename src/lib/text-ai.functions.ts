import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Generic ChatGPT-style text writer. Used by the inline Editable component
 * and any admin surface that needs AI-authored copy.
 */
export const generateSiteText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({
      // "hero.title" — used to give the AI context of what the field is
      fieldId: z.string().optional(),
      // Free-form instruction from the admin (may be blank)
      instruction: z.string().max(2000).optional(),
      // The current text so the AI can improve / rewrite it
      current: z.string().max(4000).optional(),
      // A hard max length (chars) for the generated text
      maxChars: z.number().int().positive().max(4000).optional(),
      // Optional context — e.g. page label, brand tone
      context: z.string().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Forbidden");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const brand = "Point Studio — a professional photo & video studio in Bucharest (food, product, advertising, corporate, portrait, editorial). Voice: confident, minimal, editorial, first-person plural.";
    const cap = data.maxChars ?? 240;

    const system = `You write website copy for ${brand}. Return STRICT JSON only: {"text": string}. No markdown, no quotes. Keep under ${cap} characters. Match the tone of the field.`;
    const user = [
      data.fieldId ? `Field id: ${data.fieldId}` : "",
      data.context ? `Context: ${data.context}` : "",
      data.current ? `Current text: """${data.current}"""` : "",
      data.instruction ? `Instruction: ${data.instruction}` : "Rewrite the current text to be sharper, more compelling, and on-brand. If there is no current text, write a fitting piece of copy for this field.",
    ].filter(Boolean).join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
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
    try {
      const parsed = JSON.parse(raw) as { text?: string };
      return { text: (parsed.text ?? "").trim() };
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      const parsed = m ? (JSON.parse(m[0]) as { text?: string }) : {};
      return { text: (parsed.text ?? "").trim() };
    }
  });
