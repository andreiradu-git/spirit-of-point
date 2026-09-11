import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import fallbackVideos from "@/data/videos.json";
import { VideoPage } from "@/pages/Video";
import { altLinks } from "@/i18n";
import { getPublicVideos } from "@/lib/video-seo.functions";
import { videoObjectJsonLd, type PublicVideo } from "@/lib/video-seo";

const alt = altLinks("/video", "ro");
const PAGE_URL = "https://www.pointstudio.ro/ro/video";

export const Route = createFileRoute("/ro/video")({
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
      { title: "Producție video și motion — Point Studio București" },
      {
        name: "description",
        content:
          "Producție video comercială, motion și reels realizate de Point Studio — studio foto-video din București.",
      },
      { property: "og:title", content: "Producție video — Point Studio" },
      { property: "og:description", content: "Motion, reels și producții video by Point Studio." },
      { property: "og:image", content: cdn(fallbackVideos[0].poster, 1600) },
      { name: "twitter:image", content: cdn(fallbackVideos[0].poster, 1600) },
      ...alt.meta,
    ],
    links: alt.links,
    scripts: (loaderData ?? []).map((v) => ({
      type: "application/ld+json",
      children: JSON.stringify(videoObjectJsonLd(v)),
    })),
  }),
});
