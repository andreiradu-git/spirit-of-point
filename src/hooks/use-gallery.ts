import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db as supabase } from "@/lib/cms-client";

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
  return {
    ...data,
    images: (data.gallery_images ?? []).sort((a, b) => a.position - b.position),
  };
}

export function useGallery(slug: string) {
  return useQuery({
    queryKey: ["gallery", slug],
    queryFn: () => fetchGallery(slug),
    staleTime: 60_000,
  });
}

export function useInvalidateGallery() {
  const qc = useQueryClient();
  return (slug: string) => qc.invalidateQueries({ queryKey: ["gallery", slug] });
}
