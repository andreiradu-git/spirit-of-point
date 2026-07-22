import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import { PortfolioPage } from "@/components/PortfolioPage";
import data from "@/data/people.json";

export const Route = createFileRoute("/people")({
  component: PeoplePage,
  head: () => ({
    meta: [
      { title: "Portrait & People Photography — Point Studio" },
      {
        name: "description",
        content: "Portrait, fashion and business photography by Point Studio in Bucharest.",
      },
      { property: "og:title", content: "Portrait & People Photography — Point Studio" },
      { property: "og:description", content: "Portraits, fashion and business photography." },
      { property: "og:image", content: cdn(data[0].src, 1600) },
      { name: "twitter:image", content: cdn(data[0].src, 1600) },
    ],
  }),
});

function PeoplePage() {
  return <PortfolioPage slug="people" tagline="Portrait, Fashion & Business Photography" fallbackImages={data} />;
}
