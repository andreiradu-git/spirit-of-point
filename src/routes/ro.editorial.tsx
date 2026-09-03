import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import data from "@/data/editorial.json";
import { EditorialPage } from "@/pages/Editorial";
import { altLinks } from "@/i18n";

const alt = altLinks("/editorial", "ro");

export const Route = createFileRoute("/ro/editorial")({
  component: EditorialPage,
  head: () => ({
    meta: [
      { title: "Fotografie editorială și de publicitate — Point Studio București" },
      {
        name: "description",
        content:
          "Fotografie editorială și de publicitate în București — editoriale de revistă, reclame print și campanii outdoor realizate de Point Studio.",
      },
      {
        name: "keywords",
        content:
          "fotografie editoriala, fotografie de publicitate, fotografie de revista, print advertising, campanii foto Bucuresti, fotograf comercial",
      },
      { property: "og:title", content: "Fotografie editorială și de publicitate — Point Studio" },
      { property: "og:description", content: "Portofoliul nostru editorial și tipărit." },
      { property: "og:image", content: cdn(data[0].src, 1600) },
      { name: "twitter:image", content: cdn(data[0].src, 1600) },
      ...alt.meta,
    ],
    links: alt.links,
  }),
});
