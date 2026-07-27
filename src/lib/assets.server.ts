import { listR2ObjectsDirect, optimizedKeyFor, type R2Object } from "@/lib/r2.server";

export type SiteAsset = {
  kind: "image" | "video" | "link" | "file";
  url: string;
  source: string;
  alt?: string | null;
  name?: string;
  size?: number;
  contentType?: string;
  lastModified?: string;
  storagePath?: never;
  r2Key?: string;
  usedOnSite: boolean;
  // For images, the paired optimized WebP (if any).
  optimizedKey?: string;
  optimizedUrl?: string;
  optimizedSize?: number;
  optimizedLastModified?: string;
  // True when this R2 entry is itself an optimized/ file with no matching
  // original — kept so admins can still delete/inspect it.
  isOrphanOptimized?: boolean;
};

function kindFromKey(key: string): SiteAsset["kind"] {
  const k = key.toLowerCase();
  if (/\.(mp4|webm|mov|m4v)(\?.*)?$/.test(k)) return "video";
  if (/\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)(\?.*)?$/.test(k)) return "image";
  return "file";
}

function assetFromR2(object: R2Object): SiteAsset {
  return {
    kind: kindFromKey(object.key),
    url: object.url,
    source: "Cloudflare R2",
    name: object.key.split("/").pop(),
    size: object.size,
    contentType: object.contentType,
    lastModified: object.lastModified,
    r2Key: object.key,
    usedOnSite: false,
  };
}

export async function listAllAssetsDirect(): Promise<SiteAsset[]> {
  const referencedAssets: SiteAsset[] = [];

  try {
    const videos = (await import("@/data/videos.json")).default as Array<{ src: string; alt?: string }>;
    for (const v of videos) {
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
    // Index every optimized/ object by its exact key so we can pair it to an
    // original by computing `optimizedKeyFor(originalKey)`.
    const byKey = new Map(objects.map((o) => [o.key, o]));
    const consumedOptimized = new Set<string>();
    const paired: SiteAsset[] = [];

    for (const obj of objects) {
      if (obj.key.startsWith("optimized/")) continue; // handled via pairing pass
      const base = assetFromR2(obj);
      if (base.kind === "image") {
        const optKey = optimizedKeyFor(obj.key);
        const opt = byKey.get(optKey);
        if (opt) {
          consumedOptimized.add(optKey);
          base.optimizedKey = opt.key;
          base.optimizedUrl = opt.url;
          base.optimizedSize = opt.size;
          base.optimizedLastModified = opt.lastModified;
        }
      }
      paired.push(base);
    }

    // Orphan optimized files (no matching original) — still surface them so
    // admins can delete or inspect.
    for (const obj of objects) {
      if (!obj.key.startsWith("optimized/")) continue;
      if (consumedOptimized.has(obj.key)) continue;
      const a = assetFromR2(obj);
      a.isOrphanOptimized = true;
      paired.push(a);
    }

    r2Assets = paired;
  } catch (e) {
    console.error("R2 listing failed", e);
  }

  return [...r2Assets, ...referencedAssets];
}
