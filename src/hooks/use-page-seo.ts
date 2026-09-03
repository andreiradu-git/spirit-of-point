import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/cms-client";

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
      const { data, error } = await db.from("page_seo").select("*");
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

  // Track pageview — one anonymous event per SPA navigation.
  // Country/city/device are derived by the Worker from the request itself, so
  // no IP address, user-agent string or fingerprint leaves the browser.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (path.startsWith("/admin") || path.startsWith("/auth")) return;
    // React StrictMode / rerenders must not double-count the same navigation.
    const marker = `${path}?${window.location.search}`;
    if (lastTracked === marker) return;
    lastTracked = marker;

    let sid = window.sessionStorage.getItem("ps_sid");
    if (!sid) {
      sid = crypto.randomUUID();
      window.sessionStorage.setItem("ps_sid", sid);
    }

    const params = new URLSearchParams(window.location.search);
    const searchQuery = params.get("q") || params.get("s") || params.get("search") || null;

    void fetch("/api/public/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        path,
        lang: path === "/ro" || path.startsWith("/ro/") ? "ro" : "en",
        referrer: document.referrer || null,
        sessionId: sid,
        searchQuery,
      }),
    }).catch(() => {});
  }, [path]);

}

