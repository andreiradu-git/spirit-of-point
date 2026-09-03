import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/cms-client";

export type SiteSettings = {
  showVideo: boolean;
  showWanders: boolean;
  showTestimonials: boolean;
  showFotografieCulinara: boolean;
};

const DEFAULTS: SiteSettings = {
  showVideo: true,
  showWanders: true,
  showTestimonials: true,
  showFotografieCulinara: true,
};

/**
 * Canonical D1 key holding every public visibility flag.
 *
 * These flags used to live in `localStorage`, which meant an admin toggling
 * "Show testimonials" only changed their own browser — every visitor kept
 * getting the built-in defaults. The single source of truth is now this
 * `site_settings` row, so the toggles behave the same for everyone.
 */
export const SITE_FLAGS_KEY = "setting.site-flags";

function coerce(raw: unknown): SiteSettings {
  const v = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  const bool = (key: keyof SiteSettings, legacy?: string): boolean => {
    const candidates = legacy ? [v[key], v[legacy]] : [v[key]];
    for (const c of candidates) {
      if (typeof c === "boolean") return c;
      if (c === "true" || c === 1) return true;
      if (c === "false" || c === 0) return false;
    }
    return DEFAULTS[key];
  };
  return {
    showVideo: bool("showVideo"),
    showWanders: bool("showWanders", "showPatterns"),
    showTestimonials: bool("showTestimonials"),
    showFotografieCulinara: bool("showFotografieCulinara"),
  };
}

export function useSiteSettings() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["site-flags"],
    queryFn: async (): Promise<SiteSettings> => {
      const { data, error } = await db
        .from("site_settings")
        .select("value")
        .eq("key", SITE_FLAGS_KEY)
        .maybeSingle();
      if (error) throw error;
      return coerce(data?.value ?? null);
    },
    staleTime: 30_000,
  });

  const settings = query.data ?? DEFAULTS;
  const ready = query.isSuccess;

  const update = async (patch: Partial<SiteSettings>) => {
    const next = { ...settings, ...patch };
    qc.setQueryData(["site-flags"], next);
    const { error } = await db
      .from("site_settings")
      .upsert({ key: SITE_FLAGS_KEY, value: next as unknown as never }, { onConflict: "key" });
    if (error) {
      await qc.invalidateQueries({ queryKey: ["site-flags"] });
      throw error;
    }
    await qc.invalidateQueries({ queryKey: ["site-flags"] });
  };

  return { settings, update, ready };
}
