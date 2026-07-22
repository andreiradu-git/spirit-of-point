import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const IMAGE_PREFIX = "image.";

async function fetchImages(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .like("key", `${IMAGE_PREFIX}%`);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    const id = row.key.slice(IMAGE_PREFIX.length);
    const v = row.value;
    if (typeof v === "string") map[id] = v;
    else if (v && typeof v === "object" && "url" in v) {
      const url = (v as Record<string, unknown>).url;
      if (typeof url === "string") map[id] = url;
    }
  }
  return map;
}

export function useSiteImages() {
  return useQuery({
    queryKey: ["site-images"],
    queryFn: fetchImages,
    staleTime: 60_000,
  });
}

export function useImage(id: string, fallback: string): string {
  const { data } = useSiteImages();
  return data?.[id] ?? fallback;
}

export function useSaveImage() {
  const qc = useQueryClient();
  return async (id: string, url: string) => {
    const key = `${IMAGE_PREFIX}${id}`;
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key, value: { url } }, { onConflict: "key" });
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["site-images"] });
  };
}
