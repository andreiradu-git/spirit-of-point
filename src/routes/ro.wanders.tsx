import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import data from "@/data/wanders.json";
import { WandersPage } from "@/pages/Wanders";
import { altLinks } from "@/i18n";

const alt = altLinks("/wanders", "ro");

export const Route = createFileRoute("/ro/wanders")({
  component: WandersPage,
  head: () => ({
    meta: [
      { title: "Reflecții — Fotografie artistică personală — Point Studio" },
      { name: "description", content: "Momente țesute în lucrări artistice personale." },
      { property: "og:title", content: "Reflecții — Point Studio" },
      { property: "og:description", content: "Momente țesute în lucrări artistice personale." },
      { property: "og:image", content: cdn(data[0].src, 1600) },
      { name: "twitter:image", content: cdn(data[0].src, 1600) },
      ...alt.meta,
    ],
    links: alt.links,
  }),
});
