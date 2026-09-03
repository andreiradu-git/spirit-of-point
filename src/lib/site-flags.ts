// Canonical public visibility flags.
//
// These live in a single D1 `site_settings` row so an admin toggle changes the
// site for every visitor, and they are fetched in the root route loader so the
// server-rendered HTML and the hydrated DOM agree — a flag that is OFF must
// never appear in the initial HTML and then vanish (or the reverse).

import { db } from "@/lib/cms-client";

export type SiteSettings = {
  showVideo: boolean;
  showWanders: boolean;
  showTestimonials: boolean;
  showFotografieCulinara: boolean;
};

export const SITE_FLAGS_KEY = "setting.site-flags";

export const SITE_FLAG_DEFAULTS: SiteSettings = {
  showVideo: true,
  showWanders: true,
  showTestimonials: true,
  showFotografieCulinara: true,
};

/** Normalises booleans stored as true/false, "true"/"false", 1/0 or null. */
export function coerceSiteFlags(raw: unknown): SiteSettings {
  const v = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  const bool = (key: keyof SiteSettings, legacy?: string[]): boolean => {
    const candidates = [v[key], ...(legacy ?? []).map((k) => v[k])];
    for (const c of candidates) {
      if (typeof c === "boolean") return c;
      if (c === "true" || c === 1 || c === "1") return true;
      if (c === "false" || c === 0 || c === "0") return false;
    }
    return SITE_FLAG_DEFAULTS[key];
  };
  return {
    showVideo: bool("showVideo", ["show_video"]),
    showWanders: bool("showWanders", ["showPatterns", "show_wanders"]),
    showTestimonials: bool("showTestimonials", ["show_testimonials", "testimonials_enabled"]),
    showFotografieCulinara: bool("showFotografieCulinara", ["show_fotografie_culinara"]),
  };
}

export async function fetchSiteFlags(): Promise<SiteSettings> {
  const { data, error } = await db
    .from("site_settings")
    .select("value")
    .eq("key", SITE_FLAGS_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return coerceSiteFlags((data as { value?: unknown } | null)?.value ?? null);
}
