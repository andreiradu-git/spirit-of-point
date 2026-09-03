import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/cms-client";

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
  const { data, error } = await db
    .from("galleries")
    .select("*, gallery_images(*)")
    .eq("slug", slug)
    .order("position", { referencedTable: "gallery_images" })
    .maybeSingle();
  // `null` means "this gallery has not been created yet" and is the ONLY case
  // in which a page may fall back to its bundled source images. A transport or
  // SQL failure must surface as an error, never as an uninitialised gallery.
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    ...data,
    images: ((data.gallery_images ?? []) as GalleryImage[]).sort((a, b) => a.position - b.position),
  };
}

export function useGallery(slug: string) {
  return useQuery({
    queryKey: ["gallery", slug],
    queryFn: () => fetchGallery(slug),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useInvalidateGallery() {
  const qc = useQueryClient();
  return (slug: string) => qc.invalidateQueries({ queryKey: ["gallery", slug] });
}
