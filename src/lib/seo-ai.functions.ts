import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KIND = z.enum(["seo", "alt"]);

/**
 * SEO / alt-text generator. AI is delegated to `ai-service.server.ts`.
 * Supabase is used only for the admin gate (temporary, until Auth phase).
 */
export const generateSeoContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        kind: KIND,
        path: z.string().optional(),
        label: z.string().optional(),
        imageUrl: z.string().url().optional(),
        context: z.string().optional(),
        extraKeywords: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden");

    const svc = await import("./ai-service.server");

    if (data.kind === "seo") {
      return svc.generateSeoText({
        path: data.path,
        label: data.label,
        extraKeywords: data.extraKeywords,
      });
    }

    if (!data.imageUrl) throw new Error("imageUrl required for alt generation");
    return svc.generateAltText({
      imageUrl: data.imageUrl,
      context: data.context,
    });
  });
