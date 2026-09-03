import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import data from "@/data/patterns.json";
import { PatternsPage } from "@/pages/Patterns";
import { altLinks } from "@/i18n";

const alt = altLinks("/patterns", "ro");

export const Route = createFileRoute("/ro/patterns")({
  component: PatternsPage,
  head: () => ({
    meta: [
      { title: "Modele, texturi și prim-planuri de produs — Point Studio" },
      {
        name: "description",
        content: "Texturi, fundaluri și prim-planuri de produs realizate de Point Studio, București.",
      },
      {
        name: "keywords",
        content: "fotografie de produs, fotografie de textura, fotografie prim-plan, still life, macro produs",
      },
      { property: "og:title", content: "Modele și prim-planuri de produs — Point Studio" },
      { property: "og:description", content: "Texturi, fundaluri și prim-planuri." },
      { property: "og:image", content: cdn(data[0].src, 1600) },
      { name: "twitter:image", content: cdn(data[0].src, 1600) },
      ...alt.meta,
    ],
    links: alt.links,
  }),
});
