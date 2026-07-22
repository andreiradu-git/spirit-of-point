import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, cdn } from "@/components/SiteLayout";
import { Gallery } from "@/components/Gallery";
import data from "@/data/people.json";

export const Route = createFileRoute("/people")({
  component: PeoplePage,
  head: () => ({
    meta: [
      { title: "Portrait & People Photography — Point Studio" },
      {
        name: "description",
        content:
          "Portrait, fashion and business photography by Point Studio in Bucharest.",
      },
      { property: "og:title", content: "Portrait & People Photography — Point Studio" },
      { property: "og:description", content: "Portraits, fashion and business photography." },
      { property: "og:image", content: cdn(data[0].src, 1600) },
      { name: "twitter:image", content: cdn(data[0].src, 1600) },
    ],
  }),
});

function PeoplePage() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-24">
        <Gallery images={data} columns={3} />
      </div>
    </SiteLayout>
  );
}

