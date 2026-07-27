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
      language: z.enum(["en", "ro"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Forbidden");

    const { openaiChat, parseJsonLoose } = await import("./openai.server");

    const lang = data.language ?? "en";
    const brand = lang === "ro"
      ? "Point Studio — studio profesional foto & video din București (food, product, advertising, corporate, portret, editorial). Ton: încrezător, minimal, editorial, persoana I plural (noi)."
      : "Point Studio — a professional photo & video studio in Bucharest (food, product, advertising, corporate, portrait, editorial). Voice: confident, minimal, editorial, first-person plural.";
    const cap = data.maxChars ?? 240;

    const langRule = lang === "ro"
      ? "SCRIE OBLIGATORIU ÎN LIMBA ROMÂNĂ, cu diacritice (ă â î ș ț). Nu folosi engleză."
      : "Write in English.";

    const system = `You write website copy for ${brand}. ${langRule} Return STRICT JSON only: {"text": string}. No markdown, no quotes. Keep under ${cap} characters. Match the tone of the field.`;
    const user = [
      data.fieldId ? `Field id: ${data.fieldId}` : "",
      data.context ? `Context: ${data.context}` : "",
      data.current ? `Current text: """${data.current}"""` : "",
      data.instruction
        ? `Instruction: ${data.instruction}`
        : (lang === "ro"
            ? "Rescrie textul curent să fie mai clar, convingător și pe brand. Dacă nu există text curent, scrie o variantă potrivită pentru acest câmp."
            : "Rewrite the current text to be sharper, more compelling, and on-brand. If there is no current text, write a fitting piece of copy for this field."),
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
