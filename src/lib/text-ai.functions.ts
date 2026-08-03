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

/**
 * Generates a full set of page copy for a gallery/category page:
 * subtitle, description, seo_title, meta_description.
 */
export const generateGalleryPageCopy = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        galleryTitle: z.string().max(120),
        gallerySlug: z.string().max(80).optional(),
        existingDescription: z.string().max(8000).optional(),
        instruction: z.string().max(2000).optional(),
        language: z.enum(["en", "ro"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const svc = await import("./ai-service.server");
    const lang = data.language ?? "en";
    const { langRuleFor, brandFor, aiChat, parseJsonLoose } = svc;

    const system = [
      langRuleFor(lang),
      `You write website copy for ${brandFor(lang)}.`,
      'Return STRICT JSON only with keys: {"subtitle": string, "description": string, "seo_title": string, "meta_description": string}.',
      "subtitle: 1 short evocative line (max 80 chars). description: 2-4 paragraphs about this photographic category — style, mood, subjects, why clients choose it; natural writing, no keyword stuffing. seo_title: max 60 chars. meta_description: 140-160 chars. No markdown.",
    ].join(" ");

    const user = [
      `Gallery/category: "${data.galleryTitle}" (slug: ${data.gallerySlug ?? data.galleryTitle.toLowerCase()}).`,
      data.existingDescription ? `Existing description: """${data.existingDescription}"""` : "",
      data.instruction ? `Instruction: ${data.instruction}` : (
        lang === "ro"
          ? "Scrie sau îmbunătățește textele pentru această pagină de categorie foto, păstrând tonul editorial și profesional."
          : "Write or improve the copy for this photography category page, keeping it editorial and professional."
      ),
    ].filter(Boolean).join("\n");

    const raw = await aiChat({
      jsonMode: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const parsed = parseJsonLoose<{
      subtitle?: string;
      description?: string;
      seo_title?: string;
      meta_description?: string;
    }>(raw);

    return {
      subtitle: (parsed.subtitle ?? "").trim(),
      description: (parsed.description ?? "").trim(),
      seo_title: (parsed.seo_title ?? "").trim().slice(0, 80),
      meta_description: (parsed.meta_description ?? "").trim().slice(0, 200),
    };
  });

