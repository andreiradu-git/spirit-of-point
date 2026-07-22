import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import { PortfolioPage } from "@/components/PortfolioPage";
import data from "@/data/editorial.json";

export const Route = createFileRoute("/editorial")({
  component: EditorialPage,
  head: () => ({
    meta: [
      { title: "Editorial & Printed Work — Point Studio" },
      {
        name: "description",
        content: "Printed work, ads, magazines and outdoor campaigns by Point Studio.",
      },
      { property: "og:title", content: "Editorial & Printed Work — Point Studio" },
      { property: "og:description", content: "Our editorial and printed portfolio." },
      { property: "og:image", content: cdn(data[0].src, 1600) },
      { name: "twitter:image", content: cdn(data[0].src, 1600) },
    ],
  }),
});

function EditorialPage() {
  return <PortfolioPage tagline="Editorial & Printed Work" images={data} />;
}
