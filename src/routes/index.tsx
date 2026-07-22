import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, cdn } from "@/components/SiteLayout";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
      { property: "og:image", content: cdn(home[1].src, 1600) },
      { name: "twitter:image", content: cdn(home[1].src, 1600) },
    ],
  }),
});

function Index() {
  const fish = home[1]; // aqw.png — fish + knives hero
  const logos = home.filter((i) => /logo|Kaufland/i.test(i.src) && !/LOGO_PSP/i.test(i.src));


  const studioShots = [home[20], home[21], home[24], home[26], home[29], home[30], home[31], home[32]].filter(Boolean);

  const whatWeDo = [
    { label: "Food", img: home[22]?.src, slug: "food" },
    { label: "People", img: home[24]?.src, slug: "people" },
    { label: "Editorial", img: home[28]?.src, slug: "editorial" },
    { label: "Corporate", img: home[27]?.src, slug: "corporate" },
    { label: "Landscape", img: home[29]?.src, slug: "landscape" },
    { label: "Industrial", img: home[31]?.src, slug: "industrial" },
  ];

  const [studioActive, setStudioActive] = useState<number | null>(null);
  useEffect(() => {
    if (studioActive === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStudioActive(null);
      if (e.key === "ArrowRight") setStudioActive((a) => (a === null ? a : (a + 1) % studioShots.length));
      if (e.key === "ArrowLeft") setStudioActive((a) => (a === null ? a : (a - 1 + studioShots.length) % studioShots.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studioActive, studioShots.length]);


  return (
    <SiteLayout transparentHeader headerTone="light">
      {/* Hero — fish image at natural aspect ratio, text overlaid and scaled to image width */}
      <section className="relative w-full bg-white">
        <div className="relative w-full" style={{ containerType: "size" }}>
          <img
            src={cdn(fish.src, 2400)}
            alt="Point Studio food photography"
            className="block w-full h-auto"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent pointer-events-none" />
          <div
            className="absolute inset-0 z-10 flex flex-col justify-between"
            style={{
              paddingLeft: "5cqi",
              paddingRight: "5cqi",
              paddingTop: "clamp(5rem, 13cqb, 9rem)",
              paddingBottom: "clamp(1.5rem, 7cqb, 5rem)",
            }}
          >
            <div className="max-w-[58%] text-white">
              <h1
                className="font-sans font-bold uppercase tracking-tight leading-[1.05]"
                style={{ fontSize: "min(3.8cqi, 6.5cqb)" }}
              >
                Photo-Video Studio and<br />Creative Workspace.
              </h1>
              <p
                className="text-white/85 leading-snug"
                style={{ fontSize: "min(1.3cqi, 2.2cqb)", marginTop: "1.4cqb" }}
              >
                We blend creativity with technical expertise and a deep commitment to
                quality and thats how we transform your ideas into stunning visuals
                that captivate and sell.
              </p>
              <p
                className="font-sans font-bold uppercase tracking-tight leading-tight"
                style={{ fontSize: "min(1.7cqi, 2.9cqb)", marginTop: "1.4cqb" }}
              >
                Let's create toghether<br />unforgetable images!
              </p>
            </div>
            <div className="flex text-white" style={{ gap: "3cqi" }}>
              <div>
                <div className="font-sans font-bold leading-none" style={{ fontSize: "min(2.6cqi, 4.4cqb)" }}>10+</div>
                <div className="uppercase tracking-widest text-white/70" style={{ fontSize: "min(0.8cqi, 1.3cqb)", marginTop: "0.5cqb" }}>
                  Years of<br />expertise
                </div>
              </div>
              <div>
                <div className="font-sans font-bold leading-none" style={{ fontSize: "min(2.6cqi, 4.4cqb)" }}>50+</div>
                <div className="uppercase tracking-widest text-white/70" style={{ fontSize: "min(0.8cqi, 1.3cqb)", marginTop: "0.5cqb" }}>
                  International<br />clients
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Client logos band — evenly distributed on desktop */}
      {logos.length > 0 && (
        <section className="border-b border-border bg-background">
          <div className="mx-auto max-w-7xl px-4 md:px-8 py-6 md:py-8">
            <div className="flex flex-wrap md:flex-nowrap justify-center md:justify-between items-center gap-x-6 gap-y-4">
              {logos.map((l) => (
                <img
                  key={l.src}
                  src={cdn(l.src, 200)}
                  alt="Client logo"
                  className="h-6 md:h-7 w-auto object-contain opacity-80 hover:opacity-100 transition shrink-0"
                />
              ))}
            </div>
          </div>
        </section>
      )}


      {/* The Studio */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="mb-12 flex items-end justify-between gap-8 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-[0.5em] text-muted-foreground mb-3">
              Our Space
            </div>
            <h2 className="font-sans font-bold uppercase tracking-tight text-5xl md:text-7xl leading-[0.95]">
              The Studio
            </h2>
          </div>
          <div className="max-w-md text-[15px] leading-relaxed text-foreground/80">
            <p>
              Managed by <strong>Andrei C. Radu</strong>, graduate in Photo-Video of the
              National Arts University. <strong>Point Studio</strong> is a professional
              photography studio &amp; creative workspace in Bucharest — part of Atelierele
              Scanteia in the House of Free Press.
            </p>
          </div>
        </div>

        {/* Asymmetric mosaic */}
        <div className="grid grid-cols-6 auto-rows-[110px] md:auto-rows-[160px] gap-3">
          {studioShots[0] && <StudioTile img={studioShots[0]} className="col-span-3 row-span-2" onOpen={() => setStudioActive(0)} />}
          {studioShots[1] && <StudioTile img={studioShots[1]} className="col-span-3 row-span-1" onOpen={() => setStudioActive(1)} />}
          {studioShots[2] && <StudioTile img={studioShots[2]} className="col-span-2 row-span-1" onOpen={() => setStudioActive(2)} />}
          {studioShots[3] && <StudioTile img={studioShots[3]} className="col-span-1 row-span-1" onOpen={() => setStudioActive(3)} />}
          {studioShots[4] && <StudioTile img={studioShots[4]} className="col-span-2 row-span-2" onOpen={() => setStudioActive(4)} />}
          {studioShots[5] && <StudioTile img={studioShots[5]} className="col-span-2 row-span-1" onOpen={() => setStudioActive(5)} />}
          {studioShots[6] && <StudioTile img={studioShots[6]} className="col-span-2 row-span-1" onOpen={() => setStudioActive(6)} />}
          {studioShots[7] && <StudioTile img={studioShots[7]} className="col-span-2 row-span-2" onOpen={() => setStudioActive(7)} />}
        </div>

        <div className="mt-10 grid md:grid-cols-2 gap-10 text-[15px] leading-relaxed text-foreground/80">
          <p>
            Point Studio is a 200 sqm professional photo-video studio and creative workspace.
            The space provides professional photo setups, equipment and specialists to accommodate
            every brief. Accessible parking, Wi-Fi and comfortable working space allow clients to
            be present for the entire session.
          </p>
          <p>
            The fully equipped kitchen and extensive prop room on-site, coupled with long-lasting
            relations with food stylists, prop researchers, hair &amp; makeup specialists and other
            collaborators, assure a great work experience.
          </p>
        </div>
      </section>

      {/* What We Do */}
      <section className="bg-neutral-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="mb-12 flex items-end justify-between gap-8 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.5em] text-white/50 mb-3">
                Disciplines
              </div>
              <h2 className="font-sans font-bold uppercase tracking-tight text-5xl md:text-7xl leading-[0.95]">
                What We Do
              </h2>
            </div>
            <div className="max-w-md text-[15px] leading-relaxed text-white/75">
              <p>
                From mouthwatering food photography that brings flavors to life to portraits,
                architecture, corporate events, industrial documentation and landscape — our
                lens tells your story beautifully.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {whatWeDo.map((c) => (
              <Link
                key={c.label}
                to="/work/$slug"
                params={{ slug: c.slug }}
                className="relative aspect-[3/4] overflow-hidden group block bg-neutral-900"
              >
                {c.img && (
                  <img
                    src={cdn(c.img, 700)}
                    alt={c.label}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="text-white font-sans font-bold uppercase tracking-tight text-sm md:text-base">
                    {c.label}
                  </div>
                  <div className="mt-1 h-px w-6 bg-white/70 group-hover:w-full transition-all duration-500" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {studioActive !== null && studioShots[studioActive] && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setStudioActive(null)}>
          <button className="absolute top-4 right-6 text-white text-sm uppercase tracking-widest" onClick={() => setStudioActive(null)}>Close</button>
          <button className="absolute left-4 md:left-8 text-white text-3xl px-3" onClick={(e) => { e.stopPropagation(); setStudioActive((a) => a === null ? a : (a - 1 + studioShots.length) % studioShots.length); }} aria-label="Previous">‹</button>
          <img src={cdn(studioShots[studioActive].src, 2000)} alt={studioShots[studioActive].alt || ""} className="max-h-[90vh] max-w-[90vw] object-contain" onClick={(e) => e.stopPropagation()} />
          <button className="absolute right-4 md:right-8 text-white text-3xl px-3" onClick={(e) => { e.stopPropagation(); setStudioActive((a) => a === null ? a : (a + 1) % studioShots.length); }} aria-label="Next">›</button>
        </div>
      )}
    </SiteLayout>
  );
}

function StudioTile({ img, className = "", onOpen }: { img: { src: string; alt: string }; className?: string; onOpen?: () => void }) {
  return (
    <button onClick={onOpen} className={`relative overflow-hidden group bg-muted ${className}`}>
      <img
        src={cdn(img.src, 1200)}
        alt={img.alt}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
    </button>
  );
}
