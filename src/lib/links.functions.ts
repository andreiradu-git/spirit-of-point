import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Link-metadata generator. AI is delegated to `ai-service.server.ts`.
 * Supabase is used only for the admin gate (temporary, until Auth phase).
 */
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

    const { generateLinkMetadata } = await import("./ai-service.server");
    return generateLinkMetadata({ url: data.url, context: data.context });
  });
