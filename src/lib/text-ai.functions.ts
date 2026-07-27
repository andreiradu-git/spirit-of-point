import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Generic ChatGPT-style text writer. Used by the inline Editable component
 * and any admin surface that needs AI-authored copy.
 * Calls OpenAI directly — no Supabase dependency for AI.
 */
export const generateSiteText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({
      fieldId: z.string().optional(),
      instruction: z.string().max(2000).optional(),
      current: z.string().max(4000).optional(),
      maxChars: z.number().int().positive().max(4000).optional(),
      context: z.string().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Forbidden");

    const { openaiChat, parseJsonLoose } = await import("./openai.server");

    const brand = "Point Studio — a professional photo & video studio in Bucharest (food, product, advertising, corporate, portrait, editorial). Voice: confident, minimal, editorial, first-person plural.";
    const cap = data.maxChars ?? 240;

    const system = `You write website copy for ${brand}. Return STRICT JSON only: {"text": string}. No markdown, no quotes. Keep under ${cap} characters. Match the tone of the field.`;
    const user = [
      data.fieldId ? `Field id: ${data.fieldId}` : "",
      data.context ? `Context: ${data.context}` : "",
      data.current ? `Current text: """${data.current}"""` : "",
      data.instruction ? `Instruction: ${data.instruction}` : "Rewrite the current text to be sharper, more compelling, and on-brand. If there is no current text, write a fitting piece of copy for this field.",
    ].filter(Boolean).join("\n");

    const raw = await openaiChat({
      jsonMode: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const parsed = parseJsonLoose<{ text?: string }>(raw);
    return { text: (parsed.text ?? "").trim() };
  });
