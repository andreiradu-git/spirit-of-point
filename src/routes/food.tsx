import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import data from "@/data/food.json";
import { FoodPage } from "@/pages/Food";
import { altLinks } from "@/i18n";

const alt = altLinks("/food", "en");

export const Route = createFileRoute("/food")({
  component: FoodPage,
  head: () => ({
    meta: [
      { title: "Best Food Photography & Food Photographer — Point Studio Bucharest" },
      {
        name: "description",
        content:
          "Best food photography in Bucharest — professional food, product and advertising photography by Point Studio. Tabletop, editorial and commercial food photographer.",
      },
      {
        name: "keywords",
        content:
          "best food photography, best food photographer, food photography Bucharest, product photography, advertising photography, tabletop photography, commercial food photographer, professional photography",
      },
      { property: "og:title", content: "Best Food Photography — Point Studio Bucharest" },
      { property: "og:description", content: "Professional food, product and tabletop photography." },
      { property: "og:image", content: cdn(data[0].src, 1600) },
      { name: "twitter:image", content: cdn(data[0].src, 1600) },
      ...alt.meta,
    ],
    links: alt.links,
  }),
});
