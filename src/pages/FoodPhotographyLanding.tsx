import { Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import type { FotografieCulinaraContent } from "@/data/fotografie-culinara";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { Editable } from "@/components/Editable";
import { EditableTextList } from "@/components/EditableTextList";
import { EditableFaqList } from "@/components/EditableFaqList";

const COPY = {
  ro: {
    hiddenTitle: "Pagina este momentan ascunsă",
    hiddenBody: "Această pagină a fost dezactivată din panoul de control al site-ului.",
    back: "Înapoi la Home",
    prices: "Prețuri",
    priceLead: "Tariful pentru o ședință de fotografie culinară pornește de la",
    faq: "Întrebări frecvente",
    writeUs: "Scrie-ne la",
    orCall: "sau sună la",
    paragraph: "paragraf",
    bullet: "punct",
    step: "pas",
    extra: "paragraf suplimentar",
  },
  en: {
    hiddenTitle: "This page is currently hidden",
    hiddenBody: "This page has been disabled from the site control panel.",
    back: "Back to Home",
    prices: "Pricing",
    priceLead: "A food photography session starts from",
    faq: "Frequently asked questions",
    writeUs: "Write to us at",
    orCall: "or call",
    paragraph: "paragraph",
    bullet: "bullet",
    step: "step",
    extra: "extra paragraph",
  },
} as const;

export function FoodPhotographyLanding({
  content: C,
  ns,
  lang,
}: {
  content: FotografieCulinaraContent;
  ns: string;
  lang: "ro" | "en";
}) {
  const { settings, ready } = useSiteSettings();
  const t = COPY[lang];

  if (ready && !settings.showFotografieCulinara) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-2xl px-6 py-24 text-center space-y-4">
          <h1 className="font-serif text-2xl">{t.hiddenTitle}</h1>
          <p className="text-muted-foreground">{t.hiddenBody}</p>
          <Link to="/" className="inline-block text-sm underline underline-offset-4">
            {t.back}
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
            id={`${ns}.h1`}
            as="h1"
            lang={lang}
            className="font-serif text-3xl md:text-5xl leading-tight block"
          >
            {C.h1}
          </Editable>

          <EditableTextList
            id={`${ns}.intro`}
            fallback={C.intro}
            itemLabel={t.paragraph}
            lang={lang}
            editableTag="p"
            itemClassName="text-base md:text-lg leading-relaxed text-foreground/90"
          />
        </header>

        {C.sections.map((s, sIdx) => (
          <section key={sIdx} className="space-y-4">
            <Editable
              id={`${ns}.sections.${sIdx}.h2`}
              as="h2"
              lang={lang}
              className="font-serif text-2xl md:text-3xl block"
            >
              {s.h2}
            </Editable>

            {s.paragraphs && (
              <EditableTextList
                id={`${ns}.sections.${sIdx}.paragraphs`}
                fallback={s.paragraphs}
                itemLabel={t.paragraph}
                lang={lang}
                editableTag="p"
                itemClassName="leading-relaxed text-foreground/90"
              />
            )}
            {s.bullets && (
              <EditableTextList
                id={`${ns}.sections.${sIdx}.bullets`}
                fallback={s.bullets}
                itemLabel={t.bullet}
                lang={lang}
                as="ul"
                editableTag="li"
                className="list-disc pl-6 space-y-2 text-foreground/90"
              />
            )}
            {s.steps && (
              <EditableTextList
                id={`${ns}.sections.${sIdx}.steps`}
                fallback={s.steps}
                itemLabel={t.step}
                lang={lang}
                as="ol"
                editableTag="li"
                className="list-decimal pl-6 space-y-2 text-foreground/90"
              />
            )}
          </section>
        ))}

        <EditableTextList
          id={`${ns}.extraSections`}
          fallback={[]}
          itemLabel={t.extra}
          lang={lang}
          editableTag="p"
          itemClassName="leading-relaxed text-foreground/90"
        />

        <section className="space-y-4">
          <Editable id={`${ns}.pret.h2`} as="h2" lang={lang} className="font-serif text-2xl md:text-3xl block">
            {t.prices}
          </Editable>
          <p className="leading-relaxed text-foreground/90">
            {/* The "starts from" lead only renders once a real amount exists. */}
            {C.pretPornireDeLa ? (
              <>
                {t.priceLead}{" "}
                <Editable id={`${ns}.pret.pornireDeLa`} as="strong" lang={lang}>
                  {C.pretPornireDeLa}
                </Editable>
                .{" "}
              </>
            ) : null}
            <Editable id={`${ns}.pret.detalii`} multiline lang={lang}>
              {C.pretDetalii}
            </Editable>
          </p>

        </section>

        <section className="space-y-4">
          <Editable id={`${ns}.faq.h2`} as="h2" lang={lang} className="font-serif text-2xl md:text-3xl block">
            {t.faq}
          </Editable>
          <EditableFaqList id={`${ns}.faq`} fallback={C.faq} lang={lang} />
        </section>

        <section className="space-y-3 border-t border-border pt-8">
          <Editable id={`${ns}.cta.h2`} as="h2" lang={lang} className="font-serif text-2xl md:text-3xl block">
            {C.cta.h2}
          </Editable>
          <p className="text-foreground/90">
            {t.writeUs}{" "}
            <a className="underline" href={`mailto:${C.cta.email}`}>
              <Editable id={`${ns}.cta.email`} lang={lang}>{C.cta.email}</Editable>
            </a>{" "}
            {t.orCall}{" "}
            <a className="underline" href={`tel:${C.cta.phone.replace(/\s/g, "")}`}>
              <Editable id={`${ns}.cta.phone`} lang={lang}>{C.cta.phone}</Editable>
            </a>
            .
          </p>
        </section>
      </article>
    </SiteLayout>
  );
}
