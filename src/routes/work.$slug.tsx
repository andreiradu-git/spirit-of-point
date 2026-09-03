import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { WorkPage, resolveWork, WORK } from "@/pages/Work";
import { altLinks, tr } from "@/i18n";

const LANG: "en" | "ro" = "en";

const descLong = (title: string) => `${title} photography portfolio by Point Studio.`;
const descShort = (title: string) => `${title} photography by Point Studio.`;

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
    // Unknown slugs still render (CMS galleries resolve at runtime) but must not
    // create an unbounded set of indexable soft-404 URLs.
    const known = Object.prototype.hasOwnProperty.call(WORK, params.slug);
    return {
      meta: [
        ...(known ? [] : [{ name: "robots", content: "noindex, follow" }]),
        { title: `${title} — Point Studio` },
        {
          name: "description",
          content: descLong(title),
        },
        { property: "og:title", content: `${title} — Point Studio` },
        {
          property: "og:description",
          content: descShort(title),
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
