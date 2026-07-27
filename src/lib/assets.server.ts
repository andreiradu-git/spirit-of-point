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
    r2Assets = objects.map((object) => ({
      kind: /\.(mp4|webm|mov)(\?.*)?$/i.test(object.key) ? "video" : "image",
      url: object.url,
      source: "Cloudflare R2",
      name: object.key.split("/").pop(),
      size: object.size,
      r2Key: object.key,
      usedOnSite: false,
    }));
  } catch (e) {
    console.error("R2 listing failed", e);
  }

  return [...r2Assets, ...referencedAssets];
}