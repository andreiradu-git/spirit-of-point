import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { Gallery } from "@/components/Gallery";
import foodData from "@/data/food.json";
import peopleData from "@/data/people.json";
import editorialData from "@/data/editorial.json";
import corporateData from "@/data/work/corporate.json";
import landscapeData from "@/data/work/landscape.json";
import industrialData from "@/data/work/industrial.json";

type Img = { src: string; alt: string };

const WORK: Record<string, { title: string; data: Img[] }> = {
  food: { title: "Food", data: foodData as Img[] },
  people: { title: "People", data: peopleData as Img[] },
  editorial: { title: "Editorial", data: editorialData as Img[] },
  corporate: { title: "Corporate", data: corporateData as Img[] },
  landscape: { title: "Landscape", data: landscapeData as Img[] },
  industrial: { title: "Industrial", data: industrialData as Img[] },
};

export const Route = createFileRoute("/work/$slug")({
  component: WorkPage,
  loader: ({ params }) => {
    const w = WORK[params.slug];
    if (!w) throw notFound();
    return w;
  },
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          Category not found
        </p>
      </div>
    </SiteLayout>
  ),
  errorComponent: ({ reset }) => {
    const router = useRouter();
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <p className="text-sm text-muted-foreground">Something went wrong.</p>
          <button
            onClick={() => {
              reset();
              router.invalidate();
            }}
            className="mt-4 underline text-sm"
          >
            Retry
          </button>
        </div>
      </SiteLayout>
    );
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Work"} — Point Studio` },
      {
        name: "description",
        content: `${loaderData?.title ?? "Work"} photography portfolio by Point Studio.`,
      },
      { property: "og:title", content: `${loaderData?.title ?? "Work"} — Point Studio` },
      {
        property: "og:description",
        content: `${loaderData?.title ?? "Work"} photography by Point Studio.`,
      },
    ],
  }),
});

function WorkPage() {
  const { title, data } = Route.useLoaderData();
  const images = data.filter((i: Img) => !/LOGO_PSP/i.test(i.src));
  return (
    <SiteLayout>
      <div className="pt-10 md:pt-14 pb-8 md:pb-12">
        <p className="text-center text-[11px] md:text-xs uppercase tracking-[0.35em] md:tracking-[0.5em] text-foreground/70 px-4">
          {title}
        </p>
      </div>
      <div className="mx-auto max-w-7xl px-6 pb-24">
        <Gallery images={images} columns={3} />
      </div>
    </SiteLayout>
  );
}
