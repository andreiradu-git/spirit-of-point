import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import data from "@/data/people.json";
import { PeoplePage } from "@/pages/People";
import { altLinks } from "@/i18n";

const alt = altLinks("/people", "ro");

export const Route = createFileRoute("/ro/people")({
  component: PeoplePage,
  head: () => ({
    meta: [
      { title: "Fotografie de portret și corporate — Point Studio București" },
      {
        name: "description",
        content:
          "Fotografie corporate și de portret în București — portrete profesionale, fashion, business și headshot realizate de Point Studio.",
      },
      {
        name: "keywords",
        content:
          "fotografie de portret, fotografie corporate, fotografie business Bucuresti, fotograf headshot, fotografie fashion, fotograf profesionist",
      },
      { property: "og:title", content: "Fotografie de portret și corporate — Point Studio" },
      { property: "og:description", content: "Portrete, fashion și fotografie de business." },
      { property: "og:image", content: cdn(data[0].src, 1600) },
      { name: "twitter:image", content: cdn(data[0].src, 1600) },
      ...alt.meta,
    ],
    links: alt.links,
  }),
});
