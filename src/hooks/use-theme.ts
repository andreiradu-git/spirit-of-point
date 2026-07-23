import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    headingWeights: "300;400;500",
    bodyWeights: "300;400;500;600",
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

async function fetchTheme(): Promise<ThemeConfig> {
  const { data } = await supabase.from("site_settings").select("value").eq("key", KEY).maybeSingle();
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
  fams.push(q(t.fonts.heading, t.fonts.headingWeights));
  if (t.fonts.body !== t.fonts.heading) fams.push(q(t.fonts.body, t.fonts.bodyWeights));
  return `https://fonts.googleapis.com/css2?${fams.join("&")}&display=swap`;
}

function apply(t: ThemeConfig) {
  if (typeof document === "undefined") return;
  // Fonts stylesheet
  let link = document.getElementById("site-theme-fonts") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "stylesheet";
    link.id = "site-theme-fonts";
    document.head.appendChild(link);
  }
  link.href = googleFontsHref(t);

  // CSS variables
  const r = document.documentElement.style;
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

export function useTheme() {
  const q = useQuery({ queryKey: ["theme.config"], queryFn: fetchTheme, staleTime: 60_000 });
  useEffect(() => { if (q.data) apply(q.data); }, [q.data]);
  return q.data ?? DEFAULT_THEME;
}

export function useSaveTheme() {
  const qc = useQueryClient();
  return async (t: ThemeConfig) => {
    const { error } = await supabase.from("site_settings").upsert({ key: KEY, value: t }, { onConflict: "key" });
    if (error) throw error;
    apply(t);
    qc.invalidateQueries({ queryKey: ["theme.config"] });
  };
}

export function ThemeInjector() {
  useTheme();
  return null;
}
