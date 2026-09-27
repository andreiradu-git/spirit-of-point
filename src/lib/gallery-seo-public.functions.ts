import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { d1First, fromJson } from "@/lib/d1.server";
import type { GallerySeoData } from "@/hooks/use-gallery-seo";

const inputSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]{1,120}(#ro)?$/),
});

type SettingRow = { value: string | GallerySeoData | null };

/** Public, read-only lookup used by SSR when a gallery's editorial copy is required. */
export const getPublicGallerySeo = createServerFn({ method: "GET" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<GallerySeoData> => {
    const row = await d1First<SettingRow>(
      "SELECT value FROM site_settings WHERE key = ? LIMIT 1",
      [`gallery.seo.${data.key}`],
    );
    if (!row) throw new Error(`Required gallery SEO record is missing: ${data.key}`);

    const value = fromJson<unknown>(row.value, null);
    if (!value || typeof value !== "object") {
      throw new Error(`Required gallery SEO record is invalid: ${data.key}`);
    }
    return value as GallerySeoData;
  });