import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, cdn } from "@/components/SiteLayout";
import { Gallery } from "@/components/Gallery";
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
  return (
    <SiteLayout>
      <PageHeader title="Food" subtitle="Food, product & tabletop photography" />
      <div className="mx-auto max-w-7xl px-6 pb-24">
        <Gallery images={data} columns={3} />
      </div>
    </SiteLayout>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="mx-auto max-w-7xl px-6 pt-16 pb-12 text-center">
      <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground mb-4">{subtitle}</p>
      <h1 className="font-serif text-5xl md:text-6xl">{title}</h1>
    </section>
  );
}
