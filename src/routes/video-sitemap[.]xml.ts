// Dedicated Google video sitemap. The normal sitemap.xml is untouched.
//
// Only videos that satisfy Google's required fields (page location, title,
// description or title-derived text, thumbnail and a player/content URL) are
// listed. Entries missing a thumbnail or player URL are skipped rather than
// padded with invented data.
import { createFileRoute } from "@tanstack/react-router";
import { loadPublicVideos } from "@/lib/video-seo.server";

const BASE_URL = "https://www.pointstudio.ro";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const Route = createFileRoute("/video-sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const pageUrl = `${BASE_URL}/video`;
        const videos = (await loadPublicVideos(pageUrl)).filter(
          (v) => v.thumbnailUrl && (v.embedUrl || v.contentUrl),
        );

        // All videos live on one page, so the sitemap holds one <url> with a
        // <video:video> child per video, as the spec requires.
        const videoBlocks = videos.map((v) =>
          [
            "    <video:video>",
            `      <video:thumbnail_loc>${esc(v.thumbnailUrl!)}</video:thumbnail_loc>`,
            `      <video:title>${esc(v.name)}</video:title>`,
            `      <video:description>${esc(v.description || v.name)}</video:description>`,
            v.contentUrl ? `      <video:content_loc>${esc(v.contentUrl)}</video:content_loc>` : null,
            v.embedUrl
              ? `      <video:player_loc allow_embed="yes">${esc(v.embedUrl)}</video:player_loc>`
              : null,
            v.durationSeconds ? `      <video:duration>${v.durationSeconds}</video:duration>` : null,
            v.uploadDate
              ? `      <video:publication_date>${esc(new Date(v.uploadDate).toISOString())}</video:publication_date>`
              : null,
            "      <video:family_friendly>yes</video:family_friendly>",
            "    </video:video>",
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const entries = videoBlocks.length
          ? [["  <url>", `    <loc>${esc(pageUrl)}</loc>`, ...videoBlocks, "  </url>"].join("\n")]
          : [];

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
          ...entries,
          "</urlset>",
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
