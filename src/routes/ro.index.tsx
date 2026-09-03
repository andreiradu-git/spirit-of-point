import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import home from "@/data/home.json";
import { Index } from "@/pages/Home";
import { altLinks } from "@/i18n";

const alt = altLinks("/", "ro");

export const Route = createFileRoute("/ro/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Point Studio — Studio profesionist de fotografie în București" },
      {
        name: "description",
        content:
          "Point Studio — fotografie profesională în București pentru mâncare, produs, publicitate, corporate și portret. 10+ ani de experiență, 50+ clienți internaționali.",
      },
      {
        name: "keywords",
        content:
          "fotografie profesionala, fotografie culinara, fotograf culinar, fotografie de produs, fotografie publicitara, fotografie corporate, fotografie de portret, studio foto Bucuresti, studio foto-video Romania, fotograf comercial Bucuresti",
      },
      { property: "og:title", content: "Point Studio — Studio profesionist de fotografie în București" },
      {
        property: "og:description",
        content:
          "Studio profesionist de fotografie de mâncare, produs, portret și editorial, în București.",
      },
      { property: "og:image", content: cdn(home[1].src, 1600) },
      { name: "twitter:image", content: cdn(home[1].src, 1600) },
      ...alt.meta,
    ],
    links: alt.links,
  }),
});
