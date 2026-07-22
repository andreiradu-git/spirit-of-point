import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function publicUrl(bucket: string, path: string) {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("Missing SUPABASE_URL");
  return `${url}/storage/v1/object/public/${bucket}/${encodeURIComponent(path)}`;
}

function sanitizePath(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const uploadImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        file: z.instanceof(File).refine((f) => f.size <= MAX_FILE_SIZE, "Max 20 MB"),
        prefix: z.string().default("uploads"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!ACCEPTED_TYPES.includes(data.file.type)) {
      throw new Error("Only JPG, PNG, WebP or GIF images are allowed");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ext = data.file.name.split(".").pop() || "jpg";
    const base = sanitizePath(data.file.name.replace(/\.[^.]+$/, "")) || "image";
    const path = `${data.prefix}/${base}-${Date.now()}.${ext}`;

    const arrayBuffer = await data.file.arrayBuffer();
    const { error } = await supabaseAdmin.storage.from("media").upload(path, new Uint8Array(arrayBuffer), {
      contentType: data.file.type,
      upsert: false,
    });
    if (error) throw error;

    return { url: publicUrl("media", path), path };
  });

export const deleteImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ path: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from("media").remove([data.path]);
    if (error) throw error;
    return { ok: true };
  });

export const getGalleries = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("galleries")
    .select("*, gallery_images(*)")
    .order("position", { referencedTable: "gallery_images" });
  if (error) throw error;
  return data ?? [];
});

export const getGalleryBySlug = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
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
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
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
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
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
    const { data: gallery } = await context.supabase.from("galleries").select("id").eq("slug", data.gallerySlug).single();
    if (!gallery) throw new Error("Gallery not found");

    const { count } = await context.supabase
      .from("gallery_images")
      .select("*", { count: "exact", head: true })
      .eq("gallery_id", gallery.id);

    const { error } = await context.supabase.from("gallery_images").insert({
      gallery_id: gallery.id,
      src: data.src,
      alt: data.alt,
      title: data.title,
      position: (count ?? 0) + 1,
    });
    if (error) throw error;
    return { ok: true };
  });

export const removeGalleryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ imageId: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("gallery_images").delete().eq("id", data.imageId);
    if (error) throw error;
    return { ok: true };
  });

export const reorderGalleryImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ imageIds: z.array(z.string()) }).parse(data))
  .handler(async ({ data, context }) => {
    for (let i = 0; i < data.imageIds.length; i++) {
      const { error } = await context.supabase.from("gallery_images").update({ position: i + 1 }).eq("id", data.imageIds[i]);
      if (error) throw error;
    }
    return { ok: true };
  });

export const updateImageMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
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

import type { Database } from "@/integrations/supabase/types";
