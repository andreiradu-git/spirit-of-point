import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HeroItem = {
  id: string;
  kind: "image" | "video";
  src: string;
  poster?: string;
  alt?: string;
  caption?: string;
};

export type HeroDisplayMode = "static" | "click" | "auto";

export type HeroSettings = {
  mode: HeroDisplayMode;
  interval: 2 | 3 | 4 | 5;
};

export const HERO_ITEMS_KEY = "list.hero-gallery";
export const HERO_SETTINGS_KEY = "setting.hero-carousel";

export const DEFAULT_HERO_SETTINGS: HeroSettings = { mode: "auto", interval: 4 };

export function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(url) || /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
}

export function useHeroItems() {
  return useQuery({
    queryKey: ["hero-gallery", "items"],
    queryFn: async (): Promise<HeroItem[]> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", HERO_ITEMS_KEY)
        .maybeSingle();
      if (error) throw error;
      const v = data?.value as unknown;
      const items = Array.isArray(v)
        ? v
        : v && typeof v === "object" && Array.isArray((v as { items?: unknown }).items)
        ? (v as { items: unknown[] }).items
        : [];
      return items as HeroItem[];
    },
    staleTime: 60_000,
  });
}

export function useHeroSettings() {
  return useQuery({
    queryKey: ["hero-gallery", "settings"],
    queryFn: async (): Promise<HeroSettings> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", HERO_SETTINGS_KEY)
        .maybeSingle();
      if (error) throw error;
      const v = (data?.value ?? {}) as Partial<HeroSettings>;
      return { ...DEFAULT_HERO_SETTINGS, ...v };
    },
    staleTime: 60_000,
  });
}

export function useSaveHeroGallery() {
  const qc = useQueryClient();
  return {
    saveItems: async (items: HeroItem[]) => {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: HERO_ITEMS_KEY, value: { items } as never }, { onConflict: "key" });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["hero-gallery"] });
    },
    saveSettings: async (settings: HeroSettings) => {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: HERO_SETTINGS_KEY, value: settings as never }, { onConflict: "key" });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["hero-gallery"] });
    },
  };
}
