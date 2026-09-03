import { createFileRoute } from "@tanstack/react-router";
import { foodPhotographyContent as C } from "@/data/food-photography-bucharest";
import { FoodPhotographyLanding } from "@/pages/FoodPhotographyLanding";

const URL_CANON = "https://www.pointstudio.ro/food-photography-bucharest";
const URL_RO = "https://www.pointstudio.ro/fotografie-culinara-bucuresti";
const FAQ = C.faq.filter((f) => f.q && f.a && !/\[[A-Z ĂÂÎȘȚ]+\]/.test(f.a));
const NS = "food-photography-en";

export const Route = createFileRoute("/food-photography-bucharest")({
  component: FoodPhotographyPage,
  head: () => ({
    meta: [
      { title: C.seo.title },
      { name: "description", content: C.seo.description },
      { name: "keywords", content: C.seo.keywords },
      { property: "og:title", content: C.seo.title },
      { property: "og:description", content: C.seo.description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL_CANON },
      { property: "og:locale", content: "en_US" },
      { property: "og:image", content: C.seo.ogImage },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: C.seo.ogImage },
    ],
    links: [
      { rel: "canonical", href: URL_CANON },
      { rel: "alternate", hrefLang: "en", href: URL_CANON },
      { rel: "alternate", hrefLang: "ro", href: URL_RO },
      { rel: "alternate", hrefLang: "x-default", href: URL_CANON },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: "Point Studio — Food Photography Bucharest",
          description: C.seo.description,
          url: URL_CANON,
          telephone: C.cta.phone,
          email: C.cta.email,
          address: {
            "@type": "PostalAddress",
            addressLocality: "Bucharest",
            addressCountry: "RO",
            streetAddress: "Piața Presei Libere 1",
          },
          areaServed: "Bucharest",
        }),
      },
      // Only questions with a real answer are described; unanswered entries are
      // omitted rather than published as placeholder text.
      ...(FAQ.length
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: FAQ.map((f) => ({
                  "@type": "Question",
                  name: f.q,
                  acceptedAnswer: { "@type": "Answer", text: f.a },
                })),
              }),
            },
          ]
        : []),
    ],
  }),
});

function FoodPhotographyPage() {
  return <FoodPhotographyLanding content={C} ns={NS} lang="en" />;
}
