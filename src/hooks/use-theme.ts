import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/cms-client";
import { recordHistory } from "@/hooks/use-edit-history";

export type ThemeConfig = {
  fonts: {
    heading: string; // Google Font family
    body: string;
    headingWeights: string; // e.g. "300;400;500"
    bodyWeights: string;
  };
  colors: {
    bg: string;
    text: string;
    muted: string;
    accent: string;
    border: string;
    headerBg: string;
    headerText: string;
    footerBg: string;
    footerText: string;
  };
};

export const DEFAULT_THEME: ThemeConfig = {
  fonts: {
    heading: "Cormorant Garamond",
    body: "Inter",
    headingWeights: "300;400",
    bodyWeights: "400;500;700",
  },
  colors: {
    bg: "#ffffff",
    text: "#0a0a0a",
    muted: "#737373",
    accent: "#000000",
    border: "#e5e5e5",
    headerBg: "transparent",
    headerText: "#ffffff",
    footerBg: "#0a0a0a",
    footerText: "#ffffff",
  },
};

const KEY = "theme.config";
/** Previous configuration, kept so a typography change can always be reverted. */
export const THEME_PREVIOUS_KEY = "theme.config.previous";

async function fetchTheme(): Promise<ThemeConfig> {
  const { data } = await db.from("site_settings").select("value").eq("key", KEY).maybeSingle();
  const raw = data?.value as Partial<ThemeConfig> | null;
  if (!raw) return DEFAULT_THEME;
  return {
    fonts: { ...DEFAULT_THEME.fonts, ...(raw.fonts ?? {}) },
    colors: { ...DEFAULT_THEME.colors, ...(raw.colors ?? {}) },
  };
}

function googleFontsHref(t: ThemeConfig) {
  const fams: string[] = [];
  const q = (name: string, weights: string) =>
    `family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@${weights}`;
  // The display family always ships its italic — italic is part of the type system.
  const italicQ = (name: string, weights: string) => {
    const list = weights.split(";").filter(Boolean);
    const axes = [...list.map((w) => `0,${w}`), ...list.map((w) => `1,${w}`)].join(";");
    return `family=${encodeURIComponent(name).replace(/%20/g, "+")}:ital,wght@${axes}`;
  };
  fams.push(italicQ(t.fonts.heading, t.fonts.headingWeights));
  if (t.fonts.body !== t.fonts.heading) fams.push(q(t.fonts.body, t.fonts.bodyWeights));
  return `https://fonts.googleapis.com/css2?${fams.join("&")}&display=swap`;
}


export function applyTheme(t: ThemeConfig) {
  if (typeof document === "undefined") return;
  // Fonts stylesheet
  let link = document.getElementById("site-theme-fonts") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "stylesheet";
    link.id = "site-theme-fonts";
    document.head.appendChild(link);
  }
  const href = googleFontsHref(t);
  if (link.href !== href) link.href = href;

  // CSS variables
  const r = document.documentElement.style;
  // The two families of the typography system. Every `type-*` utility reads
  // these, so a theme change flows through the whole site and the editor.
  r.setProperty("--font-serif", `"${t.fonts.heading}", Georgia, serif`);
  r.setProperty("--font-sans", `"${t.fonts.body}", ui-sans-serif, system-ui, sans-serif`);
  r.setProperty("--site-font-heading", `"${t.fonts.heading}", serif`);
  r.setProperty("--site-font-body", `"${t.fonts.body}", sans-serif`);
  r.setProperty("--site-bg", t.colors.bg);
  r.setProperty("--site-text", t.colors.text);
  r.setProperty("--site-muted", t.colors.muted);
  r.setProperty("--site-accent", t.colors.accent);
  r.setProperty("--site-border", t.colors.border);
  r.setProperty("--site-header-bg", t.colors.headerBg);
  r.setProperty("--site-header-text", t.colors.headerText);
  r.setProperty("--site-footer-bg", t.colors.footerBg);
  r.setProperty("--site-footer-text", t.colors.footerText);
}

/**
 * Apply a configuration to the live DOM without persisting it — the
 * "Preview" half of the preview → apply workflow. A reload restores the
 * saved configuration because nothing was written.
 */
export const previewTheme = applyTheme;

/* ---------------------------------------------------------------- *
 * Preview → Apply
 *
 * A preview configuration lives in sessionStorage, so the real site (in the
 * same tab, including inside the admin preview frame) renders with the draft
 * typography using real components and real content. Nothing is persisted, so
 * closing the preview or reloading elsewhere restores the saved theme.
 * ---------------------------------------------------------------- */
export const THEME_PREVIEW_STORAGE_KEY = "pointstudio.theme.preview";
const PREVIEW_EVENT = "pointstudio:theme-preview";

export function getThemePreview(): ThemeConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(THEME_PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ThemeConfig>;
    return {
      fonts: { ...DEFAULT_THEME.fonts, ...(parsed.fonts ?? {}) },
      colors: { ...DEFAULT_THEME.colors, ...(parsed.colors ?? {}) },
    };
  } catch {
    return null;
  }
}

/** Show `t` on the live site without saving it. Pass null to stop previewing. */
export function setThemePreview(t: ThemeConfig | null) {
  if (typeof window === "undefined") return;
  if (t) window.sessionStorage.setItem(THEME_PREVIEW_STORAGE_KEY, JSON.stringify(t));
  else window.sessionStorage.removeItem(THEME_PREVIEW_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(PREVIEW_EVENT));
}

function usePreviewOverride(): ThemeConfig | null {
  const [preview, setPreview] = useState<ThemeConfig | null>(null);
  useEffect(() => {
    const read = () => setPreview(getThemePreview());
    read();
    window.addEventListener(PREVIEW_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(PREVIEW_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return preview;
}

export function useTheme() {
  const q = useQuery({ queryKey: ["theme.config"], queryFn: fetchTheme, staleTime: 60_000 });
  const preview = usePreviewOverride();
  const effective = preview ?? q.data ?? null;
  useEffect(() => { if (effective) applyTheme(effective); }, [effective]);
  return effective ?? DEFAULT_THEME;
}

/** The configuration that was live before the last apply, if any. */
export function usePreviousTheme() {
  const q = useQuery({
    queryKey: ["theme.config.previous"],
    queryFn: async (): Promise<ThemeConfig | null> => {
      const { data } = await db
        .from("site_settings")
        .select("value")
        .eq("key", THEME_PREVIOUS_KEY)
        .maybeSingle();
      const raw = data?.value as Partial<ThemeConfig> | null;
      if (!raw) return null;
      return {
        fonts: { ...DEFAULT_THEME.fonts, ...(raw.fonts ?? {}) },
        colors: { ...DEFAULT_THEME.colors, ...(raw.colors ?? {}) },
      };
    },
    staleTime: 10_000,
  });
  return q.data ?? null;
}

export function useSaveTheme() {
  const qc = useQueryClient();

  const write = async (t: ThemeConfig, previous: ThemeConfig) => {
    // Keep the configuration being replaced so it can always be restored,
    // even after the in-memory history is gone.
    await db
      .from("site_settings")
      .upsert({ key: THEME_PREVIOUS_KEY, value: previous }, { onConflict: "key" });
    const { error } = await db.from("site_settings").upsert({ key: KEY, value: t }, { onConflict: "key" });
    if (error) throw error;
    applyTheme(t);
    await qc.invalidateQueries({ queryKey: ["theme.config"] });
    await qc.invalidateQueries({ queryKey: ["theme.config.previous"] });
  };

  return async (t: ThemeConfig, options?: { record?: boolean }) => {
    const prev = await fetchTheme();
    await write(t, prev);
    if (options?.record === false) return;
    recordHistory({
      label: "Typography & colours",
      undo: () => write(prev, t),
      redo: () => write(t, prev),
    });
  };
}


export function ThemeInjector() {
  useTheme();
  return null;
}
