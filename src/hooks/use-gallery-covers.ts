import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/cms-client";

const PREFIX = "gallery.cover.";

/** Map of gallery slug -> chosen cover image src. */
async function fetchCovers(): Promise<Record<string, string>> {
  const { data, error } = await db
    .from("site_settings")
    .select("key, value")
    .like("key", `${PREFIX}%`);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as Array<{ key: string; value: unknown }>) {
    const slug = row.key.slice(PREFIX.length);
    const v = row.value;
    if (typeof v === "string") map[slug] = v;
    else if (v && typeof v === "object" && typeof (v as { src?: unknown }).src === "string") {
      map[slug] = (v as { src: string }).src;
    }
  }
  return map;
}

export function useGalleryCovers() {
  return useQuery({ queryKey: ["gallery-covers"], queryFn: fetchCovers, staleTime: 60_000 });
}

/** Cover for one gallery, falling back to the first image src passed in. */
export function useGalleryCover(slug: string, fallback?: string): string | undefined {
  const { data } = useGalleryCovers();
  return data?.[slug] ?? fallback;
}

export function useSetGalleryCover() {
  const qc = useQueryClient();
  return async (slug: string, src: string | null) => {
    const key = `${PREFIX}${slug}`;
    if (src === null) {
      const { error } = await db.from("site_settings").delete().eq("key", key);
      if (error) throw error;
    } else {
      const { error } = await db
        .from("site_settings")
        .upsert({ key, value: { src } }, { onConflict: "key" });
      if (error) throw error;
    }
    qc.invalidateQueries({ queryKey: ["gallery-covers"] });
  };
}
