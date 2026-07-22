import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, cdn } from "@/components/SiteLayout";
import { Gallery } from "@/components/Gallery";
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
  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-6 pt-16 pb-12 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground mb-4">
          Press · Ads · Magazines · Books
        </p>
        <h1 className="font-serif text-5xl md:text-6xl">Editorial</h1>
      </section>
      <div className="mx-auto max-w-7xl px-6 pb-24">
        <Gallery images={data} columns={3} />
      </div>
    </SiteLayout>
  );
}
