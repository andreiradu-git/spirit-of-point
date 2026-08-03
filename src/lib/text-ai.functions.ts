import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Generic ChatGPT-style text writer. Pure OpenAI — zero Supabase dependency.
 */
export const generateSiteText = createServerFn({ method: "POST" })
  .inputValidator((d) =>
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
  .handler(async ({ data }) => {
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

export const generateGalleryDescription = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        title: z.string().max(200),
        subtitle: z.string().max(300).optional(),
        currentHtml: z.string().max(12000).optional(),
        action: z.enum(["generate", "rewrite", "expand", "shorten", "seo"]).default("rewrite"),
        language: z.enum(["en", "ro"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { generateGalleryDescriptionHtml } = await import("./ai-service.server");
    return generateGalleryDescriptionHtml({
      title: data.title,
      subtitle: data.subtitle,
      currentHtml: data.currentHtml,
      action: data.action,
      language: data.language,
    });
  });
