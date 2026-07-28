import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { getMediaDbClient, inferMediaAssetForUrlDirect } from "@/lib/media-assets.server";

// NOTE: All file uploads/deletes are handled through Cloudflare R2
// (`src/lib/r2.functions.ts` — `uploadToR2` / `deleteR2Object` /
// `replaceR2Object`). Supabase Storage is no longer used anywhere on the site.



export const getGalleries = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getMediaDbClient(false) as ReturnType<typeof getMediaDbClient> & { from: (table: string) => any };
  const { data, error } = await supabase
    .from("galleries")
    .select("*, gallery_images(*)")
    .order("position", { referencedTable: "gallery_images" });
  if (error) throw error;
  return data ?? [];
});

export const getGalleryBySlug = createServerFn({ method: "GET" })
  .validator((data) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    void createClient;
    const supabase = getMediaDbClient(false) as ReturnType<typeof getMediaDbClient> & { from: (table: string) => any };
    const { data: gallery, error } = await supabase
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
    const { error } = await context.supabase
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
    const media = await inferMediaAssetForUrlDirect(data.src, data.alt);
    const { data: gallery } = await context.supabase.from("galleries").select("id").eq("slug", data.gallerySlug).single();
    if (!gallery) throw new Error("Gallery not found");

    const { count } = await context.supabase
      .from("gallery_images")
      .select("*", { count: "exact", head: true })
      .eq("gallery_id", gallery.id);

    const { error } = await context.supabase.from("gallery_images").insert({
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
    const { error } = await context.supabase.from("gallery_images").delete().eq("id", data.imageId);
    if (error) throw error;
    return { ok: true };
  });

export const reorderGalleryImages = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) => z.object({ imageIds: z.array(z.string()) }).parse(data))
  .handler(async ({ data, context }) => {
    for (let i = 0; i < data.imageIds.length; i++) {
      const { error } = await context.supabase.from("gallery_images").update({ position: i + 1 }).eq("id", data.imageIds[i]);
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
    const { error } = await context.supabase.from("gallery_images").update({ alt: data.alt, title: data.title }).eq("id", data.imageId);
    if (error) throw error;
    return { ok: true };
  });
