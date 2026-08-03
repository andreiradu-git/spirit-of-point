import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GalleryImage = {
  id: string;
  src: string;
  alt: string | null;
  title: string | null;
  position: number;
};

export type Gallery = {
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
  /** Resolved cover image URL (from cover_image_id → gallery_images.src) */
  cover_image_url: string | null;
  images: GalleryImage[];
};

async function fetchGallery(slug: string): Promise<Gallery | null> {
  const { data, error } = await supabase
    .from("galleries")
    .select("*, gallery_images(*)")
    .eq("slug", slug)
    .order("position", { referencedTable: "gallery_images" })
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  const images: GalleryImage[] = (data.gallery_images ?? []).sort(
    (a: GalleryImage, b: GalleryImage) => a.position - b.position,
  );
  const coverUrl =
    images.find((img) => img.id === data.cover_image_id)?.src ??
    images[0]?.src ??
    null;
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    tagline: data.tagline ?? null,
    subtitle: (data as { subtitle?: string | null }).subtitle ?? null,
    description: (data as { description?: string | null }).description ?? null,
    seo_title: (data as { seo_title?: string | null }).seo_title ?? null,
    meta_description: (data as { meta_description?: string | null }).meta_description ?? null,
    sort_order: (data as { sort_order?: number }).sort_order ?? 0,
    visible: (data as { visible?: boolean }).visible ?? true,
    show_in_nav: (data as { show_in_nav?: boolean }).show_in_nav ?? false,
    cover_image_id: data.cover_image_id ?? null,
    cover_image_url: coverUrl,
    images,
  };
}

async function fetchAllGalleries(): Promise<Gallery[]> {
  const { data, error } = await supabase
    .from("galleries")
    .select("*, gallery_images(*)")
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => {
    const images: GalleryImage[] = (row.gallery_images ?? []).sort(
      (a: GalleryImage, b: GalleryImage) => a.position - b.position,
    );
    const coverUrl =
      images.find((img) => img.id === row.cover_image_id)?.src ??
      images[0]?.src ??
      null;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      tagline: row.tagline ?? null,
      subtitle: (row as { subtitle?: string | null }).subtitle ?? null,
      description: (row as { description?: string | null }).description ?? null,
      seo_title: (row as { seo_title?: string | null }).seo_title ?? null,
      meta_description: (row as { meta_description?: string | null }).meta_description ?? null,
      sort_order: (row as { sort_order?: number }).sort_order ?? 0,
      visible: (row as { visible?: boolean }).visible ?? true,
      show_in_nav: (row as { show_in_nav?: boolean }).show_in_nav ?? false,
      cover_image_id: row.cover_image_id ?? null,
      cover_image_url: coverUrl,
      images,
    };
  });
}

export function useGallery(slug: string) {
  return useQuery({
    queryKey: ["gallery", slug],
    queryFn: () => fetchGallery(slug),
    staleTime: 60_000,
  });
}

export function useGalleries() {
  return useQuery({
    queryKey: ["galleries"],
    queryFn: fetchAllGalleries,
    staleTime: 60_000,
  });
}

export function useInvalidateGallery() {
  const qc = useQueryClient();
  return (slug: string) => {
    qc.invalidateQueries({ queryKey: ["gallery", slug] });
    qc.invalidateQueries({ queryKey: ["galleries"] });
  };
}

export function useInvalidateGalleries() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["galleries"] });
}
