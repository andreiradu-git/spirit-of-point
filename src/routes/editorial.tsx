import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import data from "@/data/editorial.json";
import { EditorialPage } from "@/pages/Editorial";
import { altLinks } from "@/i18n";

const alt = altLinks("/editorial", "en");

export const Route = createFileRoute("/editorial")({
  component: EditorialPage,
  head: () => ({
    meta: [
      { title: "Editorial & Advertising Photography — Point Studio Bucharest" },
      {
        name: "description",
        content:
          "Editorial and advertising photography in Bucharest — magazine editorials, print ads and outdoor campaigns by Point Studio.",
      },
      {
        name: "keywords",
        content:
          "editorial photography, advertising photography, magazine photography, print advertising, campaign photography Bucharest, commercial photographer",
      },
      { property: "og:title", content: "Editorial & Advertising Photography — Point Studio" },
      { property: "og:description", content: "Our editorial and printed portfolio." },
      { property: "og:image", content: cdn(data[0].src, 1600) },
      { name: "twitter:image", content: cdn(data[0].src, 1600) },
      ...alt.meta,
    ],
    links: alt.links,
  }),
});
