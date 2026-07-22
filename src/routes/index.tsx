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
  const fish = home[1]; // aqw.png — fish + knives hero
  const grid = home.slice(20, 32);
  const logos = home.filter((i) => /logo|Kaufland/i.test(i.src) && !/LOGO_PSP/i.test(i.src));

  return (
    <SiteLayout>
      {/* Fish hero — full width directly under header */}
      <section className="w-full">
        <img
          src={cdn(fish.src, 2000)}
          alt="Point Studio food photography"
          className="w-full h-auto object-contain"
        />
      </section>

      {/* Text block */}
      <section className="mx-auto max-w-7xl px-6 pt-10 pb-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">
          <div>
            <h1 className="font-sans font-bold uppercase tracking-tight text-3xl sm:text-4xl md:text-5xl leading-[1.05]">
              Photo-Video Studio and<br />Creative Workspace.
            </h1>
            <p className="mt-6 font-sans font-bold uppercase tracking-tight text-xl md:text-2xl leading-tight">
              Let's create toghether<br />unforgetable images!
            </p>
          </div>
          <div className="flex flex-col justify-between">
            <p className="text-base md:text-lg text-muted-foreground max-w-md leading-relaxed">
              We blend creativity with technical expertise and a deep commitment to
              quality and thats how we transform your ideas into stunning visuals
              that captivate and sell.
            </p>
            <div className="mt-8 flex gap-10">
              <div>
                <div className="font-sans font-bold text-3xl md:text-4xl">10+</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                  Years of<br />expertise
                </div>
              </div>
              <div>
                <div className="font-sans font-bold text-3xl md:text-4xl">50+</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                  International<br />clients
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Client logos band */}
      {logos.length > 0 && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-7xl px-6 py-8">
            <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4">
              {logos.map((l) => (
                <img
                  key={l.src}
                  src={cdn(l.src, 200)}
                  alt="Client logo"
                  className="h-8 md:h-9 w-auto object-contain opacity-80 hover:opacity-100 transition"
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { to: "/food", label: "Food", img: home[20]?.src || fish.src },
            { to: "/people", label: "People", img: home[24]?.src || fish.src },
            { to: "/editorial", label: "Editorial", img: home[28]?.src || fish.src },
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
    </SiteLayout>
  );
}
