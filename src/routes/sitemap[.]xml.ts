import { createFileRoute } from "@tanstack/react-router";
import { fotografieCulinaraContent } from "@/data/fotografie-culinara";

const BASE_URL = "https://www.pointstudio.ro";

type Entry = {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
};

// Public, indexable routes. Add new routes here when you create them.
const STATIC_ENTRIES: Entry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/food", changefreq: "monthly", priority: "0.8" },
  { path: "/people", changefreq: "monthly", priority: "0.8" },
  { path: "/editorial", changefreq: "monthly", priority: "0.8" },
  { path: "/patterns", changefreq: "monthly", priority: "0.6" },
  { path: "/video", changefreq: "monthly", priority: "0.7" },
  { path: "/contact", changefreq: "yearly", priority: "0.6" },
  // Work categories (/work/$slug)
  { path: "/work/food", changefreq: "monthly", priority: "0.7" },
  { path: "/work/people", changefreq: "monthly", priority: "0.7" },
  { path: "/work/editorial", changefreq: "monthly", priority: "0.7" },
  { path: "/work/corporate", changefreq: "monthly", priority: "0.7" },
  { path: "/work/landscape", changefreq: "monthly", priority: "0.7" },
  { path: "/work/industrial", changefreq: "monthly", priority: "0.7" },
  // SEO landings — always included, even when hidden from nav.
  { path: "/fotografie-culinara-bucuresti", changefreq: "monthly", priority: "0.9" },
  { path: "/food-photography-bucharest", changefreq: "monthly", priority: "0.9" },
];

// Romanian equivalents of every public page (English keeps the bare URL).
const RO_ENTRIES: Entry[] = STATIC_ENTRIES.filter(
  (e) =>
    e.path !== "/fotografie-culinara-bucuresti" &&
    e.path !== "/food-photography-bucharest",
).map((e) => ({
  ...e,
  path: e.path === "/" ? "/ro" : `/ro${e.path}`,
}));

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // touch the content module so the entry stays coupled to the page
        void fotografieCulinaraContent.h1;

        const urls = [...STATIC_ENTRIES, ...RO_ENTRIES].map((e) =>
          [
            "  <url>",
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            "  </url>",
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls,
          "</urlset>",
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
