import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { WorkPage, resolveWork } from "@/pages/Work";
import { altLinks, tr } from "@/i18n";

const LANG: "en" | "ro" = "en";

export const Route = createFileRoute("/work/$slug")({
  component: WorkRoute,
  loader: ({ params }) => {
    const w = resolveWork(params.slug);
    if (!w) throw notFound();
    return w;
  },
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          {tr(LANG, "Category not found")}
        </p>
      </div>
    </SiteLayout>
  ),
  errorComponent: ({ reset }) => {
    const router = useRouter();
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <p className="text-sm text-muted-foreground">{tr(LANG, "Something went wrong.")}</p>
          <button
            onClick={() => {
              reset();
              router.invalidate();
            }}
            className="mt-4 underline text-sm"
          >
            {tr(LANG, "Retry")}
          </button>
        </div>
      </SiteLayout>
    );
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Point Studio" }, { name: "robots", content: "noindex" }] };
    }
    const title = tr(LANG, loaderData.title);
    const alt = altLinks(`/work/${params.slug}`, LANG);
    return {
      meta: [
        { title: `${title} — Point Studio` },
        {
          name: "description",
          content: LANG === "ro"
            ? `Portofoliu de fotografie ${title} realizat de Point Studio, București.`
            : `${title} photography portfolio by Point Studio.`,
        },
        { property: "og:title", content: `${title} — Point Studio` },
        {
          property: "og:description",
          content: LANG === "ro"
            ? `Fotografie ${title} realizată de Point Studio.`
            : `${title} photography by Point Studio.`,
        },
        ...alt.meta,
      ],
      links: alt.links,
    };
  },
});

function WorkRoute() {
  const { title, data } = Route.useLoaderData();
  const { slug } = Route.useParams();
  return <WorkPage slug={slug} title={title} data={data} />;
}
