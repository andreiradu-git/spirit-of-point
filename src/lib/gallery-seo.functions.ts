import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Generates a localized SEO bundle (article, FAQs, meta fields) for a gallery page. */
export const generateGallerySeo = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        gallerySlug: z.string().min(1).max(120),
        galleryTitle: z.string().max(200).optional(),
        location: z.string().max(120).optional(),
        keywords: z.string().max(500).optional(),
        current: z.string().max(12000).optional(),
        language: z.enum(["en", "ro"]).optional(),
        category: z.string().max(120).optional(),
        description: z.string().max(1000).optional(),
        tags: z.array(z.string().max(60)).max(30).optional(),
        relatedGalleries: z.array(z.string().max(120)).max(30).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { generateGallerySeoArticle } = await import("./ai-service.server");
    return generateGallerySeoArticle(data);
  });
