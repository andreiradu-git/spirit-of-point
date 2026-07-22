import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, cdn } from "@/components/SiteLayout";
import { Gallery } from "@/components/Gallery";
import data from "@/data/patterns.json";

export const Route = createFileRoute("/patterns")({
  component: PatternsPage,
  head: () => ({
    meta: [
      { title: "Patterns & Closeups — Point Studio" },
      {
        name: "description",
        content: "Textures, backgrounds and closeups from the Point Studio workspace.",
      },
      { property: "og:title", content: "Patterns & Closeups — Point Studio" },
      { property: "og:description", content: "Textures, backgrounds and closeups." },
      { property: "og:image", content: cdn(data[0].src, 1600) },
      { name: "twitter:image", content: cdn(data[0].src, 1600) },
    ],
  }),
});

function PatternsPage() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-24">
        <Gallery images={data} columns={3} />
      </div>
    </SiteLayout>
  );
}

