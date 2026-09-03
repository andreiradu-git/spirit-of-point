import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import data from "@/data/wanders.json";
import { WandersPage } from "@/pages/Wanders";
import { altLinks } from "@/i18n";

const alt = altLinks("/wanders", "en");

export const Route = createFileRoute("/wanders")({
  component: WandersPage,
  head: () => ({
    meta: [
      { title: "Wanders — Personal Artistic Photography — Point Studio" },
      { name: "description", content: "Moments woven into personal, artistic work." },
      { property: "og:title", content: "Wanders — Point Studio" },
      { property: "og:description", content: "Moments woven into personal, artistic work." },
      { property: "og:image", content: cdn(data[0].src, 1600) },
      { name: "twitter:image", content: cdn(data[0].src, 1600) },
      ...alt.meta,
    ],
    links: alt.links,
  }),
});
