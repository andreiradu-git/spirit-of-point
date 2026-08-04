import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Generates a localized SEO article for a gallery/category page. */
export const generateGallerySeo = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        gallerySlug: z.string().min(1).max(120),
        galleryTitle: z.string().max(200).optional(),
        location: z.string().max(120).optional(),
        keywords: z.string().max(500).optional(),
        current: z.string().max(8000).optional(),
        language: z.enum(["en", "ro"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { generateGallerySeoArticle } = await import("./ai-service.server");
    return generateGallerySeoArticle(data);
  });
