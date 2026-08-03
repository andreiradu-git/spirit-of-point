import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GalleryImage } from "./use-gallery";

export type GalleryWithImages = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  short_description: string | null;
  description_html: string | null;
  seo_title: string | null;
  meta_description: string | null;
  visible: boolean;
  is_service: boolean;
  cover_image_id: string | null;
  position: number;
  images: GalleryImage[];
  coverImage: GalleryImage | null;
};

async function fetchGalleries(): Promise<GalleryWithImages[]> {
  const { data, error } = await supabase
    .from("galleries")
    .select("*, gallery_images(*)")
    .order("position")
    .order("position", { referencedTable: "gallery_images" });
  if (error) throw error;

  return (data ?? []).map((g) => {
    const images: GalleryImage[] = (g.gallery_images ?? []).sort((a, b) => a.position - b.position);
    const coverImage = images.find((img) => img.id === g.cover_image_id) ?? null;
    return {
      ...g,
      images,
      coverImage,
    };
  });
}

export function useGalleries() {
  return useQuery({
    queryKey: ["galleries", "all"],
    queryFn: fetchGalleries,
    staleTime: 30_000,
  });
}

export function useServiceGalleries() {
  return useQuery({
    queryKey: ["galleries", "services"],
    queryFn: async () => {
      const all = await fetchGalleries();
      return all.filter((g) => g.is_service && g.visible);
    },
    staleTime: 30_000,
  });
}

export function useInvalidateGalleries() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["galleries"] });
    qc.invalidateQueries({ queryKey: ["gallery"] });
  };
}
