import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import fallbackVideos from "@/data/videos.json";
import { VideoPage } from "@/pages/Video";
import { altLinks } from "@/i18n";

const alt = altLinks("/video", "ro");

export const Route = createFileRoute("/ro/video")({
  component: VideoPage,
  head: () => ({
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
  }),
});
