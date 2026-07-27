import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { fotografieCulinaraContent as C } from "@/data/fotografie-culinara";
import { useSiteSettings } from "@/hooks/use-site-settings";

const URL = "https://www.pointstudio.ro/fotografie-culinara-bucuresti";

export const Route = createFileRoute("/fotografie-culinara-bucuresti")({
  component: FotografieCulinaraPage,
  head: () => ({
    meta: [
      { title: C.seo.title },
      { name: "description", content: C.seo.description },
      { name: "keywords", content: C.seo.keywords },
      { property: "og:title", content: C.seo.title },
      { property: "og:description", content: C.seo.description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { property: "og:image", content: C.seo.ogImage },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: C.seo.ogImage },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: "Point Studio — Fotografie Culinară București",
          description: C.seo.description,
          url: URL,
          telephone: C.cta.phone,
          email: C.cta.email,
          address: {
            "@type": "PostalAddress",
            addressLocality: "București",
            addressCountry: "RO",
            streetAddress: "Piața Presei Libere 1",
          },
          areaServed: "București",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: C.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
});

function FotografieCulinaraPage() {
  const { settings, ready } = useSiteSettings();
  if (ready && !settings.showFotografieCulinara) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-2xl px-6 py-24 text-center space-y-4">
          <h1 className="font-serif text-2xl">Pagina este momentan ascunsă</h1>
          <p className="text-muted-foreground">
            Această pagină a fost dezactivată din panoul de control al site-ului.
          </p>
          <Link to="/" className="inline-block text-sm underline underline-offset-4">
            Înapoi la Home
          </Link>
        </div>
      </SiteLayout>
    );
  }
  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-6 py-12 md:py-20 space-y-10">
        <header className="space-y-6">
          <h1 className="font-serif text-3xl md:text-5xl leading-tight">
            {C.h1}
          </h1>
          {C.intro.map((p, i) => (
            <p key={i} className="text-base md:text-lg leading-relaxed text-foreground/90">
              {p}
            </p>
          ))}
        </header>

        {C.sections.map((s) => (
          <section key={s.h2} className="space-y-4">
            <h2 className="font-serif text-2xl md:text-3xl">{s.h2}</h2>
            {s.paragraphs?.map((p, i) => (
              <p key={i} className="leading-relaxed text-foreground/90">
                {p}
              </p>
            ))}
            {s.bullets && (
              <ul className="list-disc pl-6 space-y-2 text-foreground/90">
                {s.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
            {s.steps && (
              <ol className="list-decimal pl-6 space-y-2 text-foreground/90">
                {s.steps.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ol>
            )}
          </section>
        ))}

        <section className="space-y-4">
          <h2 className="font-serif text-2xl md:text-3xl">Prețuri</h2>
          <p className="leading-relaxed text-foreground/90">
            Tariful pentru o ședință de fotografie culinară pornește de la{" "}
            <strong>{C.pretPornireDeLa}</strong>. {C.pretDetalii}
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-2xl md:text-3xl">Întrebări frecvente</h2>
          <dl className="space-y-4">
            {C.faq.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold text-foreground">Q: {f.q}</dt>
                <dd className="mt-1 text-foreground/80">A: {f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-3 border-t border-border pt-8">
          <h2 className="font-serif text-2xl md:text-3xl">{C.cta.h2}</h2>
          <p className="text-foreground/90">
            Scrie-ne la{" "}
            <a className="underline" href={`mailto:${C.cta.email}`}>
              {C.cta.email}
            </a>{" "}
            sau sună la{" "}
            <a className="underline" href={`tel:${C.cta.phone.replace(/\s/g, "")}`}>
              {C.cta.phone}
            </a>
            .
          </p>
        </section>
      </article>
    </SiteLayout>
  );
}
