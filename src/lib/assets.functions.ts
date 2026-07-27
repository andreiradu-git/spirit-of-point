import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SiteAsset = {
  kind: "image" | "video" | "link";
  url: string;
  source: string; // "media bucket" | "gallery: food" | "site setting: hero.bg" | "videos.json" | ...
  alt?: string | null;
  name?: string;
  size?: number;
  contentType?: string;
  storagePath?: string; // for media bucket entries — enables delete
  r2Key?: string; // for R2 entries — enables delete via R2 API
  usedOnSite: boolean;
};

async function requireAdmin(context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const listAllAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Storage bucket "media" (recursive list of top-level folders + root)
    const bucketAssets: SiteAsset[] = [];
    async function walk(prefix: string) {
      const { data, error } = await supabaseAdmin.storage.from("media").list(prefix, {
        limit: 1000,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) return;
      for (const item of data ?? []) {
        const full = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null || item.metadata === null) {
          // folder
          await walk(full);
        } else {
          const url = supabaseAdmin.storage.from("media").getPublicUrl(full).data.publicUrl;
          const ct = (item.metadata as { mimetype?: string })?.mimetype ?? "";
          bucketAssets.push({
            kind: ct.startsWith("video") ? "video" : "image",
            url,
            source: "Media library",
            name: item.name,
            size: (item.metadata as { size?: number })?.size,
            contentType: ct,
            storagePath: full,
            usedOnSite: false,
          });
        }
      }
    }
    await walk("");

    // 2) Gallery images
    const { data: galleries } = await context.supabase
      .from("galleries")
      .select("slug, gallery_images(src, alt)");
    const galleryAssets: SiteAsset[] = [];
    const usedUrls = new Set<string>();
    for (const g of galleries ?? []) {
      for (const img of (g.gallery_images ?? []) as Array<{ src: string; alt: string | null }>) {
        usedUrls.add(img.src);
        galleryAssets.push({
          kind: "image",
          url: img.src,
          source: `Gallery: ${g.slug}`,
          alt: img.alt,
          usedOnSite: true,
        });
      }
    }

    // 3) site_settings (images & links stored there)
    const { data: settings } = await context.supabase
      .from("site_settings")
      .select("key, value");
    const settingAssets: SiteAsset[] = [];
    const pushSettingAsset = (url: string, key: string, alt?: string | null) => {
      if (!url || !/^https?:\/\//.test(url)) return;
      usedUrls.add(url);
      const isVideo = /\.(mp4|webm|mov)$/i.test(url) || key.includes("video");
      settingAssets.push({
        kind: isVideo ? "video" : "image",
        url,
        source: `Setting: ${key}`,
        alt: alt ?? null,
        usedOnSite: true,
      });
    };
    for (const row of settings ?? []) {
      const v = row.value as unknown;
      if (typeof v === "string") {
        pushSettingAsset(v, row.key);
      } else if (v && typeof v === "object") {
        const obj = v as Record<string, unknown>;
        if (typeof obj.url === "string") pushSettingAsset(obj.url, row.key);
        const list = Array.isArray(obj.items) ? obj.items : Array.isArray(v) ? (v as unknown[]) : null;
        if (list) {
          for (const it of list) {
            if (it && typeof it === "object") {
              const item = it as Record<string, unknown>;
              const url = typeof item.src === "string" ? item.src : typeof item.url === "string" ? item.url : null;
              const alt = typeof item.alt === "string" ? item.alt : null;
              if (url) pushSettingAsset(url, row.key, alt);
            }
          }
        }
      }
    }


    // 4) videos.json + external video links stored in list settings (rich lists)
    let videoAssets: SiteAsset[] = [];
    try {
      const videos = (await import("@/data/videos.json")).default as Array<{ src: string; alt?: string }>;
      videoAssets = videos.map((v) => ({
        kind: (/\.(mp4|webm|mov)$/i.test(v.src) ? "video" : "link") as "video" | "link",
        url: v.src,
        source: "videos.json",
        alt: v.alt,
        usedOnSite: true,
      }));
      for (const v of videos) usedUrls.add(v.src);
    } catch {
      // ignore
    }

    // Mark bucket assets used on site if their URL appears elsewhere
    for (const b of bucketAssets) if (usedUrls.has(b.url)) b.usedOnSite = true;

    return [...bucketAssets, ...galleryAssets, ...settingAssets, ...videoAssets];
  });
