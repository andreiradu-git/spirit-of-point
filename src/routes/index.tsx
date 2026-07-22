import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, cdn } from "@/components/SiteLayout";
import { Link } from "@tanstack/react-router";
import home from "@/data/home.json";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Point Studio — Photo & Video Studio in Bucharest" },
      {
        name: "description",
        content:
          "Professional food, product, portrait and editorial photography studio based in Bucharest. 10+ years of expertise, 50+ international clients.",
      },
      { property: "og:title", content: "Point Studio — Photo & Video Studio in Bucharest" },
      {
        property: "og:description",
        content:
          "Professional food, product, portrait and editorial photography studio based in Bucharest.",
      },
      { property: "og:image", content: cdn(home[0].src, 1600) },
      { name: "twitter:image", content: cdn(home[0].src, 1600) },
    ],
  }),
});

function Index() {
  const hero = home[0];
  const grid = home.slice(1, 13);
  const logos = home.filter((i) => /logo|Kaufland/i.test(i.src)).slice(0, 8);

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative h-[85vh] min-h-[560px] w-full overflow-hidden">
        <img
          src={cdn(hero.src, 2000)}
          alt="Point Studio photography"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative z-10 h-full flex flex-col justify-end px-6 md:px-16 pb-16 text-white">
          <div className="text-xs uppercase tracking-[0.4em] mb-4 opacity-80">
            Photo · Video · Creative Workspace
          </div>
          <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl max-w-4xl leading-[1.05]">
            We transform your ideas into stunning visuals that captivate and sell.
          </h1>
          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <Link
              to="/food"
              className="px-6 py-3 bg-white text-black uppercase tracking-widest text-xs hover:bg-white/90 transition"
            >
              See our work
            </Link>
            <Link
              to="/contact"
              className="px-6 py-3 border border-white uppercase tracking-widest text-xs hover:bg-white hover:text-black transition"
            >
              Let's create together
            </Link>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground mb-6">
          Bucharest, Romania
        </p>
        <p className="font-serif text-2xl md:text-3xl leading-relaxed">
          We blend creativity with technical expertise and a deep commitment to quality — that's how
          we turn briefs into images that sell.
        </p>
        <div className="mt-12 grid grid-cols-2 gap-8 max-w-lg mx-auto">
          <div>
            <div className="font-serif text-4xl">10+</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mt-2">
              Years of expertise
            </div>
          </div>
          <div>
            <div className="font-serif text-4xl">50+</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mt-2">
              International clients
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { to: "/food", label: "Food", img: home[4]?.src || hero.src },
            { to: "/people", label: "People", img: home[7]?.src || hero.src },
            { to: "/editorial", label: "Editorial", img: home[10]?.src || hero.src },
          ].map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="relative aspect-[3/4] overflow-hidden group block"
            >
              <img
                src={cdn(c.img, 1200)}
                alt={c.label}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/40 transition-colors" />
              <div className="absolute inset-0 flex items-end p-6">
                <div className="text-white font-serif text-3xl">{c.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Selected work grid */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="mb-10 flex items-end justify-between">
          <h2 className="font-serif text-3xl md:text-4xl">Selected work</h2>
          <Link to="/food" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {grid.map((img) => (
            <div key={img.src} className="aspect-square overflow-hidden bg-muted">
              <img
                src={cdn(img.src, 800)}
                alt={img.alt || "Point Studio"}
                loading="lazy"
                className="h-full w-full object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Clients */}
      {logos.length > 0 && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <p className="text-center text-xs uppercase tracking-[0.4em] text-muted-foreground mb-10">
              Trusted by
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8 items-center">
              {logos.map((l) => (
                <img
                  key={l.src}
                  src={cdn(l.src, 300)}
                  alt="Client logo"
                  className="max-h-14 mx-auto object-contain opacity-70 hover:opacity-100 transition"
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </SiteLayout>
  );
}
