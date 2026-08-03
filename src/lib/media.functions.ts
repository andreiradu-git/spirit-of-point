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
    const supabase = context?.supabase as AnyDb | undefined;
    if (!supabase) throw new Error("Admin database client unavailable");
    const { error } = await supabase
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

// ---------------------------------------------------------------------------
// Gallery CRUD + metadata
// ---------------------------------------------------------------------------

export const listAllGalleries = createServerFn({ method: "GET" }).handler(async () => {
  const db = getMediaDbClient(false) as unknown as AnyDb;
  const { data, error } = await db
    .from("galleries")
    .select("id, slug, title, tagline, subtitle, description, seo_title, meta_description, sort_order, visible, show_in_nav, cover_image_id, created_at, updated_at")
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    tagline: string | null;
    subtitle: string | null;
    description: string | null;
    seo_title: string | null;
    meta_description: string | null;
    sort_order: number;
    visible: boolean;
    show_in_nav: boolean;
    cover_image_id: string | null;
    created_at: string;
    updated_at: string;
  }>;
});

export const createGallery = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) =>
    z
      .object({
        title: z.string().min(1).max(120),
        slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
        tagline: z.string().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context?.supabase as AnyDb | undefined;
    if (!supabase) throw new Error("Admin database client unavailable");
    const { count } = await supabase
      .from("galleries")
      .select("*", { count: "exact", head: true });
    const { data: row, error } = await supabase
      .from("galleries")
      .insert({ title: data.title, slug: data.slug, tagline: data.tagline ?? null, sort_order: (count ?? 0) + 1 })
      .select("id, slug, title")
      .single();
    if (error) throw error;
    return row as { id: string; slug: string; title: string };
  });

export const updateGalleryMeta = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(120).optional(),
        slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/).optional(),
        tagline: z.string().max(300).nullable().optional(),
        subtitle: z.string().max(300).nullable().optional(),
        description: z.string().max(8000).nullable().optional(),
        seo_title: z.string().max(80).nullable().optional(),
        meta_description: z.string().max(200).nullable().optional(),
        visible: z.boolean().optional(),
        show_in_nav: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context?.supabase as AnyDb | undefined;
    if (!supabase) throw new Error("Admin database client unavailable");
    const { id, ...fields } = data;
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) payload[k] = v;
    }
    const { error } = await supabase.from("galleries").update(payload).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteGallery = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context?.supabase as AnyDb | undefined;
    if (!supabase) throw new Error("Admin database client unavailable");
    // gallery_images are deleted via ON DELETE CASCADE on the gallery_images table
    const { error } = await supabase.from("galleries").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const reorderGalleries = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) => z.object({ ids: z.array(z.string().uuid()) }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context?.supabase as AnyDb | undefined;
    if (!supabase) throw new Error("Admin database client unavailable");
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await supabase
        .from("galleries")
        .update({ sort_order: i + 1, updated_at: new Date().toISOString() })
        .eq("id", data.ids[i]);
      if (error) throw error;
    }
    return { ok: true };
  });

export const setGalleryCover = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data) =>
    z
      .object({
        galleryId: z.string().uuid(),
        imageId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context?.supabase as AnyDb | undefined;
    if (!supabase) throw new Error("Admin database client unavailable");
    const { error } = await supabase
      .from("galleries")
      .update({ cover_image_id: data.imageId, updated_at: new Date().toISOString() })
      .eq("id", data.galleryId);
    if (error) throw error;
    return { ok: true };
  });

export const getGalleryMeta = createServerFn({ method: "GET" })
  .validator((data) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const db = getMediaDbClient(false) as unknown as AnyDb;
    const { data: row, error } = await db
      .from("galleries")
      .select("id, slug, title, tagline, subtitle, description, seo_title, meta_description, sort_order, visible, show_in_nav, cover_image_id")
      .eq("slug", data.slug)
      .single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return row as {
      id: string;
      slug: string;
      title: string;
      tagline: string | null;
      subtitle: string | null;
      description: string | null;
      seo_title: string | null;
      meta_description: string | null;
      sort_order: number;
      visible: boolean;
      show_in_nav: boolean;
      cover_image_id: string | null;
    } | null;
  });

