import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Generic ChatGPT-style text writer. Used by the inline Editable component
 * and any admin surface that needs AI-authored copy.
 *
 * The AI itself is delegated to `ai-service.server.ts` (pure OpenAI).
 * `requireSupabaseAuth` is the current admin gate for the admin UI, and
 * will be replaced during the Auth migration phase.
 */
export const generateSiteText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        fieldId: z.string().optional(),
        instruction: z.string().max(2000).optional(),
        current: z.string().max(4000).optional(),
        maxChars: z.number().int().positive().max(4000).optional(),
        context: z.string().max(1000).optional(),
        language: z.enum(["en", "ro"]).optional(),
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

    const { generateSiteCopy } = await import("./ai-service.server");
    return generateSiteCopy({
      fieldId: data.fieldId,
      instruction: data.instruction,
      current: data.current,
      maxChars: data.maxChars,
      context: data.context,
      language: data.language,
    });
  });
