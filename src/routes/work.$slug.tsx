import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { PortfolioPage } from "@/components/PortfolioPage";
import { getGalleryMeta } from "@/lib/media.functions";
import foodData from "@/data/food.json";
import peopleData from "@/data/people.json";
import editorialData from "@/data/editorial.json";
import corporateData from "@/data/work/corporate.json";
import landscapeData from "@/data/work/landscape.json";
import industrialData from "@/data/work/industrial.json";

type Img = { src: string; alt: string };

// Fallback data for built-in slugs that have JSON datasets
const STATIC_FALLBACKS: Record<string, { title: string; data: Img[] }> = {
  food: { title: "Food", data: foodData as Img[] },
  people: { title: "People", data: peopleData as Img[] },
  editorial: { title: "Editorial", data: editorialData as Img[] },
  corporate: { title: "Corporate", data: corporateData as Img[] },
  landscape: { title: "Landscape", data: landscapeData as Img[] },
  industrial: { title: "Industrial", data: industrialData as Img[] },
};

export const Route = createFileRoute("/work/$slug")({
  component: WorkPage,
  loader: async ({ params }) => {
    // Prefer DB gallery metadata; fall back to static definitions
    const dbMeta = await getGalleryMeta({ data: { slug: params.slug } });
    const staticDef = STATIC_FALLBACKS[params.slug];
    if (!dbMeta && !staticDef) throw notFound();
    return {
      title: dbMeta?.title ?? staticDef?.title ?? params.slug,
      tagline: dbMeta?.tagline ?? staticDef?.title ?? params.slug,
      fallbackData: staticDef?.data ?? [],
      seoTitle: dbMeta?.seo_title ?? null,
      metaDescription: dbMeta?.meta_description ?? null,
    };
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
      { title: `${loaderData?.seoTitle ?? loaderData?.title ?? "Work"} — Point Studio` },
      {
        name: "description",
        content:
          loaderData?.metaDescription ??
          `${loaderData?.title ?? "Work"} photography portfolio by Point Studio.`,
      },
      {
        property: "og:title",
        content: `${loaderData?.seoTitle ?? loaderData?.title ?? "Work"} — Point Studio`,
      },
      {
        property: "og:description",
        content:
          loaderData?.metaDescription ??
          `${loaderData?.title ?? "Work"} photography by Point Studio.`,
      },
    ],
  }),
});

function WorkPage() {
  const { title, tagline, fallbackData } = Route.useLoaderData();
  return (
    <PortfolioPage
      slug={Route.useParams().slug}
      tagline={tagline}
      fallbackImages={fallbackData}
    />
  );
}

