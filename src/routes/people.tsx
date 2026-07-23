import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import { PortfolioPage } from "@/components/PortfolioPage";
import data from "@/data/people.json";

export const Route = createFileRoute("/people")({
  component: PeoplePage,
  head: () => ({
    meta: [
      { title: "Portrait & Corporate Photography — Point Studio Bucharest" },
      {
        name: "description",
        content:
          "Corporate and portrait photography in Bucharest — professional portraits, fashion, business and headshot photography by Point Studio.",
      },
      {
        name: "keywords",
        content:
          "portrait photography, corporate photography, business photography Bucharest, headshot photographer, fashion photography, professional photographer, best portrait photographer",
      },
      { property: "og:title", content: "Portrait & Corporate Photography — Point Studio" },
      { property: "og:description", content: "Portraits, fashion and business photography." },
      { property: "og:image", content: cdn(data[0].src, 1600) },
      { name: "twitter:image", content: cdn(data[0].src, 1600) },
    ],
  }),
});

function PeoplePage() {
  return <PortfolioPage slug="people" tagline="Portrait, Fashion & Business Photography" fallbackImages={data} />;
}
