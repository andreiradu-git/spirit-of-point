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
      <section className="mx-auto max-w-7xl px-6 pt-16 pb-12 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground mb-4">
          Textures · Backgrounds · Closeups
        </p>
        <h1 className="font-serif text-5xl md:text-6xl">Patterns</h1>
      </section>
      <div className="mx-auto max-w-7xl px-6 pb-24">
        <Gallery images={data} columns={3} />
      </div>
    </SiteLayout>
  );
}
