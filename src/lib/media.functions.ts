import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { getMediaDbClient, inferMediaAssetForUrlDirect } from "@/lib/media-assets.server";
type AnyDb = Omit<ReturnType<typeof getMediaDbClient>, "from"> & { from: (table: string) => any };

// NOTE: All file uploads/deletes are handled through Cloudflare R2
// (`src/lib/r2.functions.ts` — `uploadToR2` / `deleteR2Object` /
// `replaceR2Object`). Supabase Storage is no longer used anywhere on the site.
export const getGalleries = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getMediaDbClient(false) as unknown as AnyDb;
  const { data, error } = await supabase
    .from("galleries")
    .select("*, gallery_images(*)")
    .order("position")
    .order("position", { referencedTable: "gallery_images" });
  if (error) throw error;
  return data ?? [];
});

export const getGalleryBySlug = createServerFn({ method: "GET" })
  .validator((data) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = getMediaDbClient(false) as unknown as AnyDb;
    const { data: gallery, error } = await supabase
      .from("galleries")
      .select("*, gallery_images(*)")
      .eq("slug", data.slug)
      .order("position")
      .order("position", { referencedTable: "gallery_images" })
      .single();
    if (error) throw error;
    return gallery;
  });

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const upsertGallery = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        slug: z.string().optional(),
        title: z.string().min(1),
        subtitle: z.string().optional().nullable(),
        tagline: z.string().optional().nullable(),
        shortDescription: z.string().optional().nullable(),
        descriptionHtml: z.string().optional().nullable(),
        seoTitle: z.string().optional().nullable(),
        metaDescription: z.string().optional().nullable(),
        visible: z.boolean().optional(),
        isService: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context?.supabase as AnyDb | undefined;
    if (!supabase) throw new Error("Admin database client unavailable");

    const cleanSlug = slugify(data.slug || data.title);
    if (!cleanSlug) throw new Error("A valid slug is required");

    const payload = {
      slug: cleanSlug,
      title: data.title.trim(),
      subtitle: data.subtitle ?? null,
      tagline: data.tagline ?? null,
      short_description: data.shortDescription ?? null,
      description_html: data.descriptionHtml ?? null,
      seo_title: data.seoTitle ?? null,
      meta_description: data.metaDescription ?? null,
      visible: data.visible ?? true,
      is_service: data.isService ?? true,
    };

    if (data.id) {
      const { error } = await supabase.from("galleries").update(payload).eq("id", data.id);
      if (error) throw error;
      return { ok: true, slug: cleanSlug };
    }

    const { count } = await supabase.from("galleries").select("*", { count: "exact", head: true });
    const { error } = await supabase
      .from("galleries")
      .insert({ ...payload, position: (count ?? 0) + 1 });
    if (error) throw error;
    return { ok: true, slug: cleanSlug };
  });

export const deleteGallery = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) => z.object({ galleryId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context?.supabase as AnyDb | undefined;
    if (!supabase) throw new Error("Admin database client unavailable");

    const { error } = await supabase.from("galleries").delete().eq("id", data.galleryId);
    if (error) throw error;
    return { ok: true };
  });

export const reorderGalleries = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) => z.object({ galleryIds: z.array(z.string().uuid()) }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context?.supabase as AnyDb | undefined;
    if (!supabase) throw new Error("Admin database client unavailable");

    for (let i = 0; i < data.galleryIds.length; i++) {
      const { error } = await supabase.from("galleries").update({ position: i + 1 }).eq("id", data.galleryIds[i]);
      if (error) throw error;
    }
    return { ok: true };
  });

export const setGalleryCoverImage = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) =>
    z
      .object({
        galleryId: z.string().uuid(),
        imageId: z.string().uuid().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context?.supabase as AnyDb | undefined;
    if (!supabase) throw new Error("Admin database client unavailable");

    if (data.imageId) {
      const { data: image, error: imageError } = await supabase
        .from("gallery_images")
        .select("id, gallery_id")
        .eq("id", data.imageId)
        .maybeSingle();
      if (imageError) throw imageError;
      if (!image || image.gallery_id !== data.galleryId) throw new Error("Cover image must belong to this gallery");
    }

    const { error } = await supabase.from("galleries").update({ cover_image_id: data.imageId }).eq("id", data.galleryId);
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
    const supabase = context?.supabase as AnyDb | undefined;
    if (!supabase) throw new Error("Admin database client unavailable");
    const media = await inferMediaAssetForUrlDirect(data.src, data.alt);
    const { data: gallery } = await supabase.from("galleries").select("id").eq("slug", data.gallerySlug).single();
    if (!gallery) throw new Error("Gallery not found");

    const { count } = await supabase
      .from("gallery_images")
      .select("*", { count: "exact", head: true })
      .eq("gallery_id", gallery.id);

    const { error } = await supabase.from("gallery_images").insert({
      gallery_id: gallery.id,
      media_asset_id: media.id,
      src: media.url,
      alt: data.alt,
      title: data.title,
      position: (count ?? 0) + 1,
    });
    if (error) throw error;
    return { ok: true };
  });

export const removeGalleryImage = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) => z.object({ imageId: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context?.supabase as AnyDb | undefined;
    if (!supabase) throw new Error("Admin database client unavailable");

    const { data: linked, error: linkedError } = await supabase
      .from("galleries")
      .select("id")
      .eq("cover_image_id", data.imageId);
    if (linkedError) throw linkedError;
    if ((linked ?? []).length) {
      const ids = (linked ?? []).map((g: { id: string }) => g.id);
      const { error: clearError } = await supabase
        .from("galleries")
        .update({ cover_image_id: null })
        .in("id", ids);
      if (clearError) throw clearError;
    }

    const { error } = await supabase.from("gallery_images").delete().eq("id", data.imageId);
    if (error) throw error;
    return { ok: true };
  });

export const reorderGalleryImages = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) => z.object({ imageIds: z.array(z.string()) }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context?.supabase as AnyDb | undefined;
    if (!supabase) throw new Error("Admin database client unavailable");
    for (let i = 0; i < data.imageIds.length; i++) {
      const { error } = await supabase.from("gallery_images").update({ position: i + 1 }).eq("id", data.imageIds[i]);
      if (error) throw error;
    }
    return { ok: true };
  });

export const updateImageMeta = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) =>
    z
      .object({
        imageId: z.string(),
        alt: z.string().optional(),
        title: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context?.supabase as AnyDb | undefined;
    if (!supabase) throw new Error("Admin database client unavailable");
    const { error } = await supabase.from("gallery_images").update({ alt: data.alt, title: data.title }).eq("id", data.imageId);
    if (error) throw error;
    return { ok: true };
  });

export const moveGalleryImage = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) =>
    z
      .object({
        imageId: z.string().uuid(),
        toGalleryId: z.string().uuid(),
        toPosition: z.number().int().positive().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context?.supabase as AnyDb | undefined;
    if (!supabase) throw new Error("Admin database client unavailable");

    const { data: image, error: imageError } = await supabase
      .from("gallery_images")
      .select("gallery_id")
      .eq("id", data.imageId)
      .maybeSingle();
    if (imageError) throw imageError;
    if (!image) throw new Error("Image not found");

    const { count } = await supabase
      .from("gallery_images")
      .select("*", { count: "exact", head: true })
      .eq("gallery_id", data.toGalleryId);

    const newPosition = Math.max(1, Math.min(data.toPosition ?? (count ?? 0) + 1, (count ?? 0) + 1));
    const { error } = await supabase
      .from("gallery_images")
      .update({ gallery_id: data.toGalleryId, position: newPosition })
      .eq("id", data.imageId);
    if (error) throw error;

    const { data: oldImages, error: oldError } = await supabase
      .from("gallery_images")
      .select("id")
      .eq("gallery_id", image.gallery_id)
      .order("position");
    if (oldError) throw oldError;
    for (let i = 0; i < (oldImages ?? []).length; i++) {
      const { error: reorderError } = await supabase
        .from("gallery_images")
        .update({ position: i + 1 })
        .eq("id", oldImages[i].id);
      if (reorderError) throw reorderError;
    }

    const { data: newImages, error: newError } = await supabase
      .from("gallery_images")
      .select("id")
      .eq("gallery_id", data.toGalleryId)
      .order("position");
    if (newError) throw newError;
    for (let i = 0; i < (newImages ?? []).length; i++) {
      const { error: reorderError } = await supabase
        .from("gallery_images")
        .update({ position: i + 1 })
        .eq("id", newImages[i].id);
      if (reorderError) throw reorderError;
    }

    return { ok: true };
  });
