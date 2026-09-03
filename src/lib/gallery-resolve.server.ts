// Server-side gallery identity resolution.
//
// Galleries are addressed everywhere in the app by their canonical slug
// ("wanders", "food", …) while D1 stores a UUID primary key. The D1 `galleries`
// rows were seeded during the Squarespace migration, so any page added to the
// site afterwards (Wanders being the first) had no row: the first Add attempt
// failed with "Gallery not found" even though the page rendered its bundled
// fallback images.
//
// The resolution below closes that gap once for every gallery: a known site
// gallery is provisioned on demand, seeded with exactly the images the page is
// currently showing so nothing visibly changes and no existing row is touched.
// Unknown, browser-supplied slugs are still rejected — creation is validated
// against the registry below and against CMS `pages`, never against raw input.

import { getMediaDbClient, inferMediaAssetForUrlDirect } from "@/lib/media-assets.server";
import { withoutBrandingAssets } from "@/lib/branding-assets";

type AnyDb = { from: (table: string) => any };

/** Canonical galleries that ship with the site, with their bundled fallback data. */
const SITE_GALLERIES: Record<string, { title: string; data?: string }> = {
  hero: { title: "Homepage Hero" },
  studio: { title: "The Studio" },
  services: { title: "What We Do" },
  food: { title: "Food", data: "food.json" },
  people: { title: "People", data: "people.json" },
  editorial: { title: "Editorial", data: "editorial.json" },
  patterns: { title: "Patterns", data: "patterns.json" },
  wanders: { title: "Wanders", data: "wanders.json" },
  corporate: { title: "Corporate", data: "work/corporate.json" },
  industrial: { title: "Industrial", data: "work/industrial.json" },
  landscape: { title: "Landscape", data: "work/landscape.json" },
};

const staticData = import.meta.glob("../data/**/*.json", { eager: true }) as Record<
  string,
  { default: unknown }
>;

function fallbackImages(file?: string): Array<{ src: string; alt?: string; title?: string }> {
  if (!file) return [];
  const mod = staticData[`../data/${file}`];
  const value = mod?.default;
  if (!Array.isArray(value)) return [];
  return withoutBrandingAssets(
    value.filter(
      (v): v is { src: string; alt?: string; title?: string } =>
        !!v && typeof v === "object" && typeof (v as { src?: unknown }).src === "string",
    ),
  );
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export class GalleryResolutionError extends Error {
  constructor(public readonly slug: string) {
    super(
      `Gallery "${slug}" could not be resolved: no gallery row exists and the slug is not a known site gallery or CMS page.`,
    );
    this.name = "GalleryResolutionError";
  }
}

/**
 * Returns the D1 gallery id for a canonical slug, provisioning the row (and its
 * currently displayed images) the first time a known gallery is edited.
 */
export async function resolveGalleryIdDirect(slug: string): Promise<string> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) throw new GalleryResolutionError(slug);
  const db = getMediaDbClient(true) as unknown as AnyDb;

  const { data: existing } = await db.from("galleries").select("id").eq("slug", slug).maybeSingle();
  if (existing?.id) return existing.id as string;

  const known = SITE_GALLERIES[slug];
  let title = known?.title;
  if (!title) {
    // A gallery can also legitimately belong to a page created in the CMS.
    const { data: page } = await db.from("pages").select("slug, title").eq("slug", slug).maybeSingle();
    if (!page) throw new GalleryResolutionError(slug);
    title = (page.title as string | null) ?? titleFromSlug(slug);
  }

  const { data: created, error } = await db
    .from("galleries")
    .insert({ slug, title })
    .select("id")
    .single();
  if (error) {
    // Lost a race with a concurrent Add — re-read instead of duplicating.
    const { data: raced } = await db.from("galleries").select("id").eq("slug", slug).maybeSingle();
    if (raced?.id) return raced.id as string;
    throw new Error(error.message);
  }
  const galleryId = created.id as string;

  // Seed with the images the page renders today so the visible gallery and its
  // order are preserved once the CMS takes over rendering.
  const seed = fallbackImages(known?.data);
  let position = 1;
  for (const image of seed) {
    try {
      const media = await inferMediaAssetForUrlDirect(image.src, image.alt ?? "");
      await db.from("gallery_images").insert({
        gallery_id: galleryId,
        media_asset_id: media.id,
        src: media.url,
        alt: image.alt ?? "",
        title: image.title ?? null,
        position: position++,
      });
    } catch (e) {
      console.error("[gallery-resolve] seed failed for", image.src, e);
    }
  }

  return galleryId;
}
