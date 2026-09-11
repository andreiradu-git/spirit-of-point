// Shared, browser-safe video SEO types and JSON-LD builder.

export type PublicVideo = {
  /** Absolute page URL the video is published on. */
  pageUrl: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  /** External player URL (YouTube / Vimeo). */
  embedUrl?: string;
  /** Direct, publicly accessible video file URL. */
  contentUrl?: string;
  /** ISO 8601 date, only when known for certain. */
  uploadDate?: string;
  /** ISO 8601 duration, only when known for certain. */
  duration?: string;
  /** Seconds — sitemaps want a plain number. */
  durationSeconds?: number;
  provider: "youtube" | "vimeo" | "file";
};

/** schema.org VideoObject with only the properties that are actually known. */
export function videoObjectJsonLd(v: PublicVideo) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: v.name,
    ...(v.description ? { description: v.description } : {}),
    ...(v.thumbnailUrl ? { thumbnailUrl: v.thumbnailUrl } : {}),
    ...(v.uploadDate ? { uploadDate: v.uploadDate } : {}),
    ...(v.duration ? { duration: v.duration } : {}),
    ...(v.embedUrl ? { embedUrl: v.embedUrl } : {}),
    ...(v.contentUrl ? { contentUrl: v.contentUrl } : {}),
    
    isPartOf: { "@type": "WebPage", "@id": v.pageUrl },
  };
}
