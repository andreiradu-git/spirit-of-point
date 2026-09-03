import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serverDb } from "@/lib/db-client.server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { getMediaDbClient, inferMediaAssetForUrlDirect } from "@/lib/media-assets.server";
import { GalleryResolutionError, resolveGalleryIdDirect } from "@/lib/gallery-resolve.server";

/**
 * Resolves the canonical gallery id, converting an unresolvable slug into an
 * admin-safe message. The slug stays in the server log, never in the response.
 */
async function canonicalGalleryId(slug: string): Promise<string> {
  try {
    return await resolveGalleryIdDirect(slug);
  } catch (error) {
    if (error instanceof GalleryResolutionError) {
      console.error(`[gallery] unresolved slug "${slug}"`, error);
      throw new Error("Could not resolve the current gallery. Please reload and try again.");
    }
    throw error;
  }
}
type AnyDb = Omit<ReturnType<typeof getMediaDbClient>, "from"> & { from: (table: string) => any };

// NOTE: All file uploads/deletes are handled through Cloudflare R2
// (`src/lib/r2.functions.ts` — `uploadToR2` / `deleteR2Object` /
// `replaceR2Object`). Supabase Storage is no longer used anywhere on the site.



export const getGalleries = createServerFn({ method: "GET" }).handler(async () => {
  const db = getMediaDbClient(false) as unknown as AnyDb;
  const { data, error } = await db
    .from("galleries")
    .select("*, gallery_images(*)")
    .order("position", { referencedTable: "gallery_images" });
  if (error) throw error;
  return data ?? [];
});

export const getGalleryBySlug = createServerFn({ method: "GET" })
  .validator((data) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const db = getMediaDbClient(false) as unknown as AnyDb;
    const { data: gallery, error } = await db
      .from("galleries")
      .select("*, gallery_images(*)")
      .eq("slug", data.slug)
      .order("position", { referencedTable: "gallery_images" })
      .single();
    if (error) throw error;
    return gallery;
  });

export const upsertGallery = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) =>
    z
      .object({
        slug: z.string(),
        title: z.string(),
        tagline: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = serverDb() as unknown as AnyDb;
    const { error } = await db
      .from("galleries")
      .upsert({ slug: data.slug, title: data.title, tagline: data.tagline }, { onConflict: "slug" });
    if (error) throw error;
    return { ok: true };
  });

export const addGalleryImage = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) =>
    z
      .object({
        gallerySlug: z.string(),
        src: z.string(),
        alt: z.string().default(""),
        title: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = serverDb() as unknown as AnyDb;
    const media = await inferMediaAssetForUrlDirect(data.src, data.alt);
    // Resolves (and, for a known site gallery, provisions) the persistent D1
    // gallery identity for this slug. Never trusts the slug blindly.
    const galleryId = await canonicalGalleryId(data.gallerySlug);

    // Adding the same asset twice (double click, retry after a failed refetch)
    // must not create a second association.
    const { data: existing } = await db
      .from("gallery_images")
      .select("id")
      .eq("gallery_id", galleryId)
      .eq("src", media.url)
      .maybeSingle();
    if (existing?.id) return { ok: true, galleryId, imageId: existing.id as string, duplicate: true };

    const { count } = await db
      .from("gallery_images")
      .select("*", { count: "exact", head: true })
      .eq("gallery_id", galleryId);

    const id = crypto.randomUUID();
    const { error } = await db.from("gallery_images").insert({
      id,
      gallery_id: galleryId,
      media_asset_id: media.id,
      src: media.url,
      alt: data.alt,
      title: data.title,
      position: (count ?? 0) + 1,
    });
    if (error) throw new Error(`The image was stored but could not be added to the gallery: ${error.message}`);
    return { ok: true, galleryId, imageId: id, duplicate: false };
  });

export const removeGalleryImage = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) => z.object({ imageId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = serverDb() as unknown as AnyDb;
    // Only the association row is deleted — the media asset and its R2 object
    // are shared with the media library and other galleries.
    const { error, count } = await db.from("gallery_images").delete().eq("id", data.imageId);
    if (error) throw error;
    if (!count) {
      throw new Error("That image is no longer part of this gallery. Reload the page and try again.");
    }
    return { ok: true, removed: count as number };
  });

export const reorderGalleryImages = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) => z.object({ imageIds: z.array(z.string().uuid()).min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const db = serverDb() as unknown as AnyDb;
    for (let i = 0; i < data.imageIds.length; i++) {
      const { error, count } = await db
        .from("gallery_images")
        .update({ position: i + 1 })
        .eq("id", data.imageIds[i]);
      if (error) throw error;
      if (!count) throw new Error("Could not save the new order. Please reload and try again.");
    }
    return { ok: true };
  });

export const updateImageMeta = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) =>
    z
      .object({
        imageId: z.string().uuid(),
        alt: z.string().optional(),
        title: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = serverDb() as unknown as AnyDb;
    const values: Record<string, unknown> = {};
    if (data.alt !== undefined) values.alt = data.alt;
    if (data.title !== undefined) values.title = data.title;
    if (!Object.keys(values).length) return { ok: true };
    const { error, count } = await db.from("gallery_images").update(values).eq("id", data.imageId);
    if (error) throw error;
    if (!count) throw new Error("That image is no longer part of this gallery. Reload the page and try again.");
    return { ok: true };
  });

/**
 * Provisions the canonical D1 gallery for a slug (seeding it with the images
 * the page currently shows from its source file) and returns the resulting
 * gallery rows. Used to convert source-file placeholders into real, editable
 * gallery items the first time an admin manages an uninitialized gallery.
 */
export const materializeGallery = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) => z.object({ gallerySlug: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const galleryId = await canonicalGalleryId(data.gallerySlug);
    const db = serverDb() as unknown as AnyDb;
    const { data: images, error } = await db
      .from("gallery_images")
      .select("*")
      .eq("gallery_id", galleryId)
      .order("position");
    if (error) throw error;
    return { galleryId, images: images ?? [] };
  });
