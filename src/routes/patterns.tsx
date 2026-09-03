import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import data from "@/data/patterns.json";
import { PatternsPage } from "@/pages/Patterns";
import { altLinks } from "@/i18n";

const alt = altLinks("/patterns", "en");

export const Route = createFileRoute("/patterns")({
  component: PatternsPage,
  head: () => ({
    meta: [
      { title: "Patterns, Textures & Product Closeups — Point Studio" },
      {
        name: "description",
        content: "Textures, backgrounds and product closeups from Point Studio, Bucharest.",
      },
      {
        name: "keywords",
        content: "product photography, texture photography, closeup photography, still life photography, macro product photography",
      },
      { property: "og:title", content: "Patterns & Product Closeups — Point Studio" },
      { property: "og:description", content: "Textures, backgrounds and closeups." },
      { property: "og:image", content: cdn(data[0].src, 1600) },
      { name: "twitter:image", content: cdn(data[0].src, 1600) },
      ...alt.meta,
    ],
    links: alt.links,
  }),
});
