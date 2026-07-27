import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { listR2ObjectsDirect } from "@/lib/r2.server";

export type SiteAsset = {
  kind: "image" | "video" | "link";
  url: string;
  source: string;
  alt?: string | null;
  name?: string;
  size?: number;
  contentType?: string;
  storagePath?: never;
  r2Key?: string;
  usedOnSite: boolean;
};

function createOptionalPublicClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function pushSettingUrls(value: unknown, key: string, push: (url: string, source: string, alt?: string | null) => void) {
  if (typeof value === "string") {
    push(value, `Setting: ${key}`);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) pushSettingUrls(item, key, push);
    return;
  }
  if (!value || typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  const url = typeof obj.src === "string" ? obj.src : typeof obj.url === "string" ? obj.url : null;
  const alt = typeof obj.alt === "string" ? obj.alt : null;
  if (url) push(url, `Setting: ${key}`, alt);
  for (const nested of Object.values(obj)) {
    if (nested && typeof nested === "object") pushSettingUrls(nested, key, push);
  }
}

export async function listAllAssetsDirect(): Promise<SiteAsset[]> {
  const usedUrls = new Set<string>();
  const referencedAssets: SiteAsset[] = [];

  const supabase = createOptionalPublicClient();
  if (supabase) {
    try {
      const { data: galleries } = await supabase.from("galleries").select("slug, gallery_images(src, alt)");
      for (const g of galleries ?? []) {
        for (const img of (g.gallery_images ?? []) as Array<{ src: string; alt: string | null }>) {
          usedUrls.add(img.src);
          referencedAssets.push({ kind: "image", url: img.src, source: `Gallery: ${g.slug}`, alt: img.alt, usedOnSite: true });
        }
      }
    } catch (e) {
      console.warn("Gallery asset references unavailable", e);
    }

    try {
      const { data: settings } = await supabase.from("site_settings").select("key, value");
      const push = (url: string, source: string, alt?: string | null) => {
        if (!/^https?:\/\//.test(url)) return;
        usedUrls.add(url);
        const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(url) || source.toLowerCase().includes("video");
        referencedAssets.push({ kind: isVideo ? "video" : "image", url, source, alt: alt ?? null, usedOnSite: true });
      };
      for (const row of settings ?? []) pushSettingUrls(row.value, row.key, push);
    } catch (e) {
      console.warn("Site setting asset references unavailable", e);
    }
  }

  try {
    const videos = (await import("@/data/videos.json")).default as Array<{ src: string; alt?: string }>;
    for (const v of videos) {
      usedUrls.add(v.src);
      referencedAssets.push({
        kind: /\.(mp4|webm|mov)(\?.*)?$/i.test(v.src) ? "video" : "link",
        url: v.src,
        source: "videos.json",
        alt: v.alt,
        usedOnSite: true,
      });
    }
  } catch {
    // Optional legacy data file.
  }

  let r2Assets: SiteAsset[] = [];
  try {
    const objects = await listR2ObjectsDirect();
    r2Assets = objects.map((object) => ({
      kind: /\.(mp4|webm|mov)(\?.*)?$/i.test(object.key) ? "video" : "image",
      url: object.url,
      source: "Cloudflare R2",
      name: object.key.split("/").pop(),
      size: object.size,
      r2Key: object.key,
      usedOnSite: usedUrls.has(object.url),
    }));
  } catch (e) {
    console.error("R2 listing failed", e);
  }

  return [...r2Assets, ...referencedAssets];
}