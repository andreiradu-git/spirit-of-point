import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { fotografieCulinaraContent as C } from "@/data/fotografie-culinara";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { Editable } from "@/components/Editable";
import { EditableTextList } from "@/components/EditableTextList";
import { EditableFaqList } from "@/components/EditableFaqList";

const URL_CANON = "https://www.pointstudio.ro/fotografie-culinara-bucuresti";
const NS = "foto-culinara";

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
      { property: "og:url", content: URL_CANON },
      { property: "og:image", content: C.seo.ogImage },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: C.seo.ogImage },
    ],
    links: [{ rel: "canonical", href: URL_CANON }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: "Point Studio — Fotografie Culinară București",
          description: C.seo.description,
          url: URL_CANON,
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
          <Editable
            id={`${NS}.h1`}
            as="h1"
            lang="ro"
            className="font-serif text-3xl md:text-5xl leading-tight block"
          >
            {C.h1}
          </Editable>

          <EditableTextList
            id={`${NS}.intro`}
            fallback={C.intro}
            itemLabel="paragraf"
            lang="ro"
            editableTag="p"
            itemClassName="text-base md:text-lg leading-relaxed text-foreground/90"
          />
        </header>

        {C.sections.map((s, sIdx) => (
          <section key={sIdx} className="space-y-4">
            <Editable
              id={`${NS}.sections.${sIdx}.h2`}
              as="h2"
              lang="ro"
              className="font-serif text-2xl md:text-3xl block"
            >
              {s.h2}
            </Editable>

            {s.paragraphs && (
              <EditableTextList
                id={`${NS}.sections.${sIdx}.paragraphs`}
                fallback={s.paragraphs}
                itemLabel="paragraf"
                lang="ro"
                editableTag="p"
                itemClassName="leading-relaxed text-foreground/90"
              />
            )}
            {s.bullets && (
              <EditableTextList
                id={`${NS}.sections.${sIdx}.bullets`}
                fallback={s.bullets}
                itemLabel="punct"
                lang="ro"
                as="ul"
                editableTag="li"
                className="list-disc pl-6 space-y-2 text-foreground/90"
              />
            )}
            {s.steps && (
              <EditableTextList
                id={`${NS}.sections.${sIdx}.steps`}
                fallback={s.steps}
                itemLabel="pas"
                lang="ro"
                as="ol"
                editableTag="li"
                className="list-decimal pl-6 space-y-2 text-foreground/90"
              />
            )}
          </section>
        ))}

        {/* Secțiuni extra adăugate din CMS */}
        <EditableTextList
          id={`${NS}.extraSections`}
          fallback={[]}
          itemLabel="paragraf suplimentar"
          lang="ro"
          editableTag="p"
          itemClassName="leading-relaxed text-foreground/90"
        />

        <section className="space-y-4">
          <Editable id={`${NS}.pret.h2`} as="h2" lang="ro" className="font-serif text-2xl md:text-3xl block">
            Prețuri
          </Editable>
          <p className="leading-relaxed text-foreground/90">
            Tariful pentru o ședință de fotografie culinară pornește de la{" "}
            <Editable id={`${NS}.pret.pornireDeLa`} as="strong" lang="ro">
              {C.pretPornireDeLa}
            </Editable>
            .{" "}
            <Editable id={`${NS}.pret.detalii`} multiline lang="ro">
              {C.pretDetalii}
            </Editable>
          </p>
        </section>

        <section className="space-y-4">
          <Editable id={`${NS}.faq.h2`} as="h2" lang="ro" className="font-serif text-2xl md:text-3xl block">
            Întrebări frecvente
          </Editable>
          <EditableFaqList id={`${NS}.faq`} fallback={C.faq} lang="ro" />
        </section>

        <section className="space-y-3 border-t border-border pt-8">
          <Editable id={`${NS}.cta.h2`} as="h2" lang="ro" className="font-serif text-2xl md:text-3xl block">
            {C.cta.h2}
          </Editable>
          <p className="text-foreground/90">
            Scrie-ne la{" "}
            <a className="underline" href={`mailto:${C.cta.email}`}>
              <Editable id={`${NS}.cta.email`} lang="ro">{C.cta.email}</Editable>
            </a>{" "}
            sau sună la{" "}
            <a className="underline" href={`tel:${C.cta.phone.replace(/\s/g, "")}`}>
              <Editable id={`${NS}.cta.phone`} lang="ro">{C.cta.phone}</Editable>
            </a>
            .
          </p>
        </section>
      </article>
    </SiteLayout>
  );
}
