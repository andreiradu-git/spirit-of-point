import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const KIND = z.enum(["seo", "alt"]);

/**
 * SEO / alt-text generator. Pure OpenAI — zero Supabase dependency.
 */
export const generateSeoContent = createServerFn({ method: "POST" })
  .inputValidator((data) =>
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
  .handler(async ({ data }) => {
    const svc = await import("./ai-service.server");

    if (data.kind === "seo") {
      const r = await svc.generateSeoText({
        path: data.path,
        label: data.label,
        extraKeywords: data.extraKeywords,
      });
      return { ...r, alt: "" } as Record<string, string>;
    }

    if (!data.imageUrl) throw new Error("imageUrl required for alt generation");
    const r = await svc.generateAltText({
      imageUrl: data.imageUrl,
      context: data.context,
    });
    return { ...r, title: "", description: "", keywords: "" } as Record<string, string>;
  });
