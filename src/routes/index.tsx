import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import home from "@/data/home.json";
import { Index } from "@/pages/Home";
import { altLinks } from "@/i18n";

const alt = altLinks("/", "en");

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Point Studio — Best Professional Photography Studio in Bucharest" },
      {
        name: "description",
        content:
          "Point Studio — best professional photography in Bucharest for food, product, advertising, corporate and portrait work. 10+ years, 50+ international clients.",
      },
      {
        name: "keywords",
        content:
          "best professional photography, best food photography, best food photographer, product photography, advertising photography, corporate photography, portrait photography, photo studio Bucharest, photo video studio Romania, commercial photographer Bucharest",
      },
      { property: "og:title", content: "Point Studio — Best Professional Photography Studio in Bucharest" },
      {
        property: "og:description",
        content:
          "Professional food, product, portrait and editorial photography studio based in Bucharest.",
      },
      { property: "og:image", content: cdn(home[1].src, 1600) },
      { name: "twitter:image", content: cdn(home[1].src, 1600) },
      ...alt.meta,
    ],
    links: alt.links,
  }),
});
