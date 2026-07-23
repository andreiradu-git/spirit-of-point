import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PageSeo = {
  path: string;
  title: string | null;
  description: string | null;
  keywords: string | null;
  og_image: string | null;
};

function upsertMeta(selector: string, attr: string, name: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function useAllPageSeo() {
  return useQuery({
    queryKey: ["page_seo", "all"],
    queryFn: async (): Promise<PageSeo[]> => {
      const { data, error } = await supabase.from("page_seo").select("*");
      if (error) throw error;
      return (data ?? []) as PageSeo[];
    },
    staleTime: 60_000,
  });
}

/** Applies DB SEO overrides to <head> for current route, and logs a pageview. */
export function usePageSeoAndTrack() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: all } = useAllPageSeo();

  // Apply SEO overrides
  useEffect(() => {
    if (!all) return;
    const seo = all.find((s) => s.path === path);
    if (!seo) return;
    if (seo.title) {
      document.title = seo.title;
      upsertMeta('meta[property="og:title"]', "property", "og:title", seo.title);
    }
    if (seo.description) {
      upsertMeta('meta[name="description"]', "name", "description", seo.description);
      upsertMeta('meta[property="og:description"]', "property", "og:description", seo.description);
    }
    if (seo.keywords) {
      upsertMeta('meta[name="keywords"]', "name", "keywords", seo.keywords);
    }
    if (seo.og_image) {
      upsertMeta('meta[property="og:image"]', "property", "og:image", seo.og_image);
      upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", seo.og_image);
    }
  }, [all, path]);

  // Track pageview
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip admin routes
    if (path.startsWith("/admin") || path.startsWith("/auth")) return;
    let sid = window.sessionStorage.getItem("ps_sid");
    if (!sid) {
      sid = crypto.randomUUID();
      window.sessionStorage.setItem("ps_sid", sid);
    }

    // Best-effort geo lookup, cached per session
    const geoKey = "ps_geo";
    const cached = window.sessionStorage.getItem(geoKey);
    const geoPromise: Promise<{ country?: string; city?: string }> = cached
      ? Promise.resolve(JSON.parse(cached))
      : fetch("https://ipapi.co/json/")
          .then((r) => (r.ok ? r.json() : {}))
          .then((j: { country_name?: string; city?: string }) => {
            const g = { country: j.country_name, city: j.city };
            try {
              window.sessionStorage.setItem(geoKey, JSON.stringify(g));
            } catch {}
            return g;
          })
          .catch(() => ({}));

    // Extract search query from URL (?q= or ?s= or ?search=)
    const params = new URLSearchParams(window.location.search);
    const searchQuery = params.get("q") || params.get("s") || params.get("search") || null;

    geoPromise.then((geo) => {
      supabase
        .from("page_views")
        .insert({
          path,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent,
          session_id: sid,
          country: geo.country ?? null,
          city: geo.city ?? null,
          search_query: searchQuery,
        })
        .then(() => {}, () => {});
    });
  }, [path]);
}

