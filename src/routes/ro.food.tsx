import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import data from "@/data/food.json";
import { FoodPage } from "@/pages/Food";
import { altLinks } from "@/i18n";

const alt = altLinks("/food", "ro");

export const Route = createFileRoute("/ro/food")({
  component: FoodPage,
  head: () => ({
    meta: [
      { title: "Fotografie culinară și de produs — Point Studio București" },
      {
        name: "description",
        content:
          "Fotografie culinară profesională în București — fotografie de mâncare, produs și publicitate realizată de Point Studio. Tabletop, editorial și fotografie comercială.",
      },
      {
        name: "keywords",
        content:
          "fotografie culinara, fotograf culinar Bucuresti, fotografie de produs, fotografie publicitara, fotografie tabletop, fotograf comercial, studio foto Bucuresti",
      },
      { property: "og:title", content: "Fotografie culinară — Point Studio București" },
      { property: "og:description", content: "Fotografie profesională de mâncare, produs și tabletop." },
      { property: "og:image", content: cdn(data[0].src, 1600) },
      { name: "twitter:image", content: cdn(data[0].src, 1600) },
      ...alt.meta,
    ],
    links: alt.links,
  }),
});
