import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import { PortfolioPage } from "@/components/PortfolioPage";
import data from "@/data/editorial.json";

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
      { property: "og:url", content: "https://www.pointstudio.ro/editorial" },
    ],
    links: [{ rel: "canonical", href: "https://www.pointstudio.ro/editorial" }],
  }),
});

function EditorialPage() {
  return (
    <PortfolioPage
      slug="editorial"
      tagline="Editorial & Printed Work"
      fallbackImages={data}
      showStrip
      showLogos
    />
  );
}

