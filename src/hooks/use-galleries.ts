import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GallerySummary = { id: string; slug: string; title: string; tagline: string | null };

/** Every gallery in the CMS — new galleries appear automatically. */
export function useGalleries() {
  return useQuery({
    queryKey: ["galleries", "all"],
    queryFn: async (): Promise<GallerySummary[]> => {
      const { data, error } = await supabase
        .from("galleries")
        .select("id, slug, title, tagline")
        .order("title");
      if (error) throw error;
      return (data ?? []) as GallerySummary[];
    },
    staleTime: 60_000,
  });
}
