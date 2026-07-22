import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import { PortfolioPage } from "@/components/PortfolioPage";
import data from "@/data/food.json";

export const Route = createFileRoute("/food")({
  component: FoodPage,
  head: () => ({
    meta: [
      { title: "Food Photography — Point Studio" },
      {
        name: "description",
        content:
          "Food, product and tabletop photography by Point Studio — professional food photographers based in Bucharest.",
      },
      { property: "og:title", content: "Food Photography — Point Studio" },
      { property: "og:description", content: "Our food & tabletop photography portfolio." },
      { property: "og:image", content: cdn(data[0].src, 1600) },
      { name: "twitter:image", content: cdn(data[0].src, 1600) },
    ],
  }),
});

function FoodPage() {
  return <PortfolioPage tagline="Food, Product & Tabletop Photography" images={data} />;
}
