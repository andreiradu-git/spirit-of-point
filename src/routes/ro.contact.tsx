import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/pages/Contact";
import { altLinks } from "@/i18n";

const alt = altLinks("/contact", "ro");

export const Route = createFileRoute("/ro/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact — Point Studio, studio foto București" },
      {
        name: "description",
        content:
          "Contactează Point Studio în București pentru fotografie profesională de mâncare, produs, publicitate, corporate și portret. andrei@pointstudio.ro, +40 744 341 286.",
      },
      {
        name: "keywords",
        content: "contact fotograf Bucuresti, rezervare studio foto, fotograf profesionist Romania",
      },
      { property: "og:title", content: "Contact — Point Studio" },
      { property: "og:description", content: "Contactează Point Studio, București." },
      ...alt.meta,
    ],
    links: alt.links,
  }),
});
