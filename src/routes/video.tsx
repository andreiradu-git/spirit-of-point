import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import fallbackVideos from "@/data/videos.json";
import { VideoPage } from "@/pages/Video";
import { altLinks } from "@/i18n";
import { getPublicVideos } from "@/lib/video-seo.functions";
import { videoObjectJsonLd, type PublicVideo } from "@/lib/video-seo";
import { VIDEO_PAGE_CONTENT, videoFaqJsonLd, videoWebPageJsonLd } from "@/data/video-page-content";

const alt = altLinks("/video", "en");
const PAGE_URL = "https://www.pointstudio.ro/video";
const content = VIDEO_PAGE_CONTENT.en;

export const Route = createFileRoute("/video")({
  component: VideoPage,
  loader: async (): Promise<PublicVideo[]> => {
    try {
      return await getPublicVideos({ data: { pageUrl: PAGE_URL } });
    } catch {
      return [];
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: content.title },
      { name: "description", content: content.description },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: content.title },
      { property: "og:description", content: content.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: cdn(fallbackVideos[0].poster, 1600) },
      { name: "twitter:image", content: cdn(fallbackVideos[0].poster, 1600) },
      ...alt.meta,
    ],
    links: alt.links,
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(videoWebPageJsonLd("en", PAGE_URL)),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(videoFaqJsonLd("en")),
      },
      ...(loaderData ?? []).map((v) => ({
        type: "application/ld+json",
        children: JSON.stringify(videoObjectJsonLd(v)),
      })),
    ],
  }),
});
