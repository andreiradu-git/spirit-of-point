import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/cms-client";

const PREFIX = "gallery.seo.";

export type GalleryFaq = { q: string; a: string };

export type GallerySeoData = {
  /** Main SEO article, HTML fragment. */
  html: string;
  faqs: GalleryFaq[];
  seoTitle: string;
  metaDescription: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  altTemplate: string;
  keywords: string;
  category: string;
  tags: string[];
  location: string;
  description: string;
  /** Set when a human touched the content; AI regeneration then requires overwrite. */
  manuallyEdited?: boolean;
  updatedAt?: string;
};

export const EMPTY_GALLERY_SEO: GallerySeoData = {
  html: "",
  faqs: [],
  seoTitle: "",
  metaDescription: "",
  canonical: "",
  ogTitle: "",
  ogDescription: "",
  altTemplate: "",
  keywords: "",
  category: "",
  tags: [],
  location: "",
  description: "",
};

function coerce(value: unknown): GallerySeoData {
  if (!value || typeof value !== "object") return { ...EMPTY_GALLERY_SEO };
  const v = value as Record<string, unknown>;
  const str = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
  return {
    ...EMPTY_GALLERY_SEO,
    html: str("html"),
    seoTitle: str("seoTitle"),
    metaDescription: str("metaDescription"),
    canonical: str("canonical"),
    ogTitle: str("ogTitle"),
    ogDescription: str("ogDescription"),
    altTemplate: str("altTemplate"),
    keywords: str("keywords"),
    category: str("category"),
    location: str("location"),
    description: str("description"),
    tags: Array.isArray(v.tags) ? (v.tags.filter((t) => typeof t === "string") as string[]) : [],
    faqs: Array.isArray(v.faqs)
      ? (v.faqs as unknown[])
          .filter(
            (f): f is GalleryFaq =>
              !!f &&
              typeof f === "object" &&
              typeof (f as GalleryFaq).q === "string" &&
              typeof (f as GalleryFaq).a === "string",
          )
          .map((f) => ({ q: f.q, a: f.a }))
      : [],
    manuallyEdited: v.manuallyEdited === true,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : undefined,
  };
}

/** All gallery SEO records, keyed by slug — used for related-gallery linking too. */
async function fetchAll(): Promise<Record<string, GallerySeoData>> {
  const { data, error } = await db
    .from("site_settings")
    .select("key, value")
    .like("key", `${PREFIX}%`);
  if (error) throw error;
  const map: Record<string, GallerySeoData> = {};
  for (const row of (data ?? []) as Array<{ key: string; value: unknown }>) {
    map[row.key.slice(PREFIX.length)] = coerce(row.value);
  }
  return map;
}

export function useAllGallerySeo() {
  return useQuery({ queryKey: ["gallery-seo", "all"], queryFn: fetchAll, staleTime: 60_000 });
}

export function useGallerySeo(slug: string): GallerySeoData | undefined {
  const { data } = useAllGallerySeo();
  return data?.[slug];
}

export function useSaveGallerySeo() {
  const qc = useQueryClient();
  return async (slug: string, next: GallerySeoData) => {
    const value = { ...next, updatedAt: new Date().toISOString() };
    const { error } = await db
      .from("site_settings")
      .upsert({ key: `${PREFIX}${slug}`, value }, { onConflict: "key" });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["gallery-seo", "all"] });
  };
}
