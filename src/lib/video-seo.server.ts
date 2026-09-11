// Server-side video metadata for structured data and the video sitemap.
//
// The public /video page renders its cards from the CMS list `list.videos`
// in D1. That list is fetched in the browser, so search engines only reliably
// see the videos when the server also states them in machine-readable form.
// This module reads the same list server-side and normalises every entry into
// a VideoObject-shaped record.
//
// Nothing here is invented: only fields that genuinely exist are returned.
// Upload dates and durations come from VERIFIED_METADATA below, which records
// values read directly from the provider for the videos currently published.

import { d1First, fromJson } from "@/lib/d1.server";

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

type RawVideo = {
  title?: string;
  poster?: string;
  posterUrl?: string;
  src?: string;
  videoUrl?: string;
  description?: string;
  duration?: number;
};

/**
 * Metadata read from the provider itself (YouTube watch payload) for the
 * videos currently on the site. Keyed by provider video id.
 */
const VERIFIED_METADATA: Record<string, { uploadDate: string; duration: string; seconds: number }> = {
  sc7yDUHAXHE: { uploadDate: "2023-12-25T02:08:59-08:00", duration: "PT1M15S", seconds: 75 },
  "rbbUN-lRhWw": { uploadDate: "2022-12-05T00:21:09-08:00", duration: "PT27S", seconds: 27 },
  "3wceiy8q-S0": { uploadDate: "2024-06-06T08:47:41-07:00", duration: "PT3M", seconds: 180 },
};

function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  return m?.[1] ?? null;
}

function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m?.[1] ?? null;
}

function normalise(raw: RawVideo, pageUrl: string): PublicVideo | null {
  const src = (raw.videoUrl || raw.src || "").trim();
  const name = (raw.title || "").trim();
  if (!src || !name) return null;

  const poster = (raw.posterUrl || raw.poster || "").trim();
  const yt = youtubeId(src);
  const vm = yt ? null : vimeoId(src);
  const verified = yt ? VERIFIED_METADATA[yt] : undefined;

  const base: PublicVideo = {
    pageUrl,
    name,
    provider: yt ? "youtube" : vm ? "vimeo" : "file",
  };

  if (raw.description?.trim()) base.description = raw.description.trim();

  if (yt) {
    base.embedUrl = `https://www.youtube.com/embed/${yt}`;
    base.thumbnailUrl = poster || `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  } else if (vm) {
    base.embedUrl = `https://player.vimeo.com/video/${vm}`;
    if (poster) base.thumbnailUrl = poster;
  } else {
    base.contentUrl = src;
    if (poster) base.thumbnailUrl = poster;
  }

  if (verified) {
    base.uploadDate = verified.uploadDate;
    base.duration = verified.duration;
    base.durationSeconds = verified.seconds;
  } else if (typeof raw.duration === "number" && raw.duration > 0) {
    const seconds = Math.round(raw.duration);
    base.durationSeconds = seconds;
    base.duration = `PT${seconds}S`;
  }

  return base;
}

/** Reads the published videos from D1. Never throws — SEO must not break a page. */
export async function loadPublicVideos(pageUrl: string): Promise<PublicVideo[]> {
  try {
    const row = await d1First<{ value: unknown }>(
      "select value from site_settings where key = ?",
      ["list.videos"],
    );
    if (!row) return [];
    const parsed = fromJson<{ items?: RawVideo[] } | RawVideo[]>(row.value, []);
    const items = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
    return items
      .map((item) => normalise(item ?? {}, pageUrl))
      .filter((v): v is PublicVideo => v !== null);
  } catch {
    return [];
  }
}

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
    ...(v.thumbnailUrl ? {} : {}),
    isPartOf: { "@type": "WebPage", "@id": v.pageUrl },
  };
}
