import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/pages/Contact";
import { altLinks } from "@/i18n";

const alt = altLinks("/contact", "en");

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact — Point Studio Photography Bucharest" },
      {
        name: "description",
        content:
          "Contact Point Studio in Bucharest for professional food, product, advertising, corporate and portrait photography. andrei@pointstudio.ro, +40 744 341 286.",
      },
      {
        name: "keywords",
        content: "contact photographer Bucharest, book photo studio, professional photographer Romania",
      },
      { property: "og:title", content: "Contact — Point Studio" },
      { property: "og:description", content: "Contact Point Studio, Bucharest." },
      ...alt.meta,
    ],
    links: alt.links,
  }),
});
