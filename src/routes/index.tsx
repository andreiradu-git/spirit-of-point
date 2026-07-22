import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, cdn } from "@/components/SiteLayout";
import { Gallery } from "@/components/Gallery";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Play, Star, X } from "lucide-react";
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
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const fish = home[1]; // aqw.png — fish + knives hero
  const logos = home.filter((i) => /logo|Kaufland/i.test(i.src) && !/LOGO_PSP/i.test(i.src));


  const studioShots = [home[20], home[24], home[26], home[30], home[18], home[22], home[28], home[19], home[21], home[23]].filter(Boolean);

  const whatWeDo = [
    { label: "Food", img: home[22]?.src, slug: "food" },
    { label: "People", img: home[24]?.src, slug: "people" },
    { label: "Editorial", img: home[28]?.src, slug: "editorial" },
    { label: "Corporate", img: home[27]?.src, slug: "corporate" },
    { label: "Landscape", img: home[29]?.src, slug: "landscape" },
    { label: "Industrial", img: home[31]?.src, slug: "industrial" },
  ];

  const testimonials: Array<{
    quote?: string;
    name: string;
    role: string;
    video?: string;
    poster?: string;
  }> = [
    {
      quote:
        "Working with Point Studio was a game-changer. Andrei's eye for detail and technical precision brought our product line to life beyond what we imagined.",
      name: "Ana Popescu",
      role: "Brand Manager, Lidl România",
    },
    {
      video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      poster: home[5]?.src,
      name: "Mihai Ionescu",
      role: "Marketing Director, Kaufland",
    },
    {
      quote:
        "A rare mix of craft, patience and vision. Andrei understood our brief instantly and translated it into images that sell.",
      name: "Elena Georgescu",
      role: "Creative Lead, Carrefour",
    },
    {
      quote:
        "Fast, professional and incredibly creative. The team delivered visuals that elevated our entire campaign.",
      name: "Radu Dumitrescu",
      role: "CEO, Fresh Market",
    },
  ];


  return (
    <SiteLayout transparentHeader headerTone="light">
      {/* Hero — fish image at natural aspect ratio, text overlaid and scaled to image width */}
      <section className="relative w-full bg-white">
        <div className="relative w-full @container">
          <img
            src={cdn(fish.src, 2400)}
            alt="Point Studio food photography"
            className="block w-full h-auto"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent pointer-events-none" />
          <div className="absolute inset-0 z-10">
            <div className="mx-auto max-w-7xl h-full px-[3cqw] pt-[9cqw] pb-[3cqw] flex flex-col justify-between">
              <div className="max-w-[60%] text-white">
                <h1 className="font-sans font-bold uppercase tracking-tight leading-[1.05] text-[3.2cqw]">
                  Photo-Video Studio and Creative Workspace.
                </h1>
                <p className="mt-[1.2cqw] text-white/85 leading-snug text-[1.35cqw]">
                  We blend creativity with technical expertise
                  <br className="hidden md:inline" /> and a deep commitment to quality and thats how
                  <br className="hidden md:inline" /> we transform your ideas into stunning visuals that captivate and sell.
                </p>
                <p className="mt-[1.2cqw] font-sans font-bold uppercase tracking-tight leading-tight text-[1.7cqw]">
                  Let's create toghether unforgetable images!
                </p>
              </div>
              <div className="flex gap-[3cqw] text-white">
                <div>
                  <div className="font-sans font-bold leading-none text-[2.6cqw]">10+</div>
                  <div className="uppercase tracking-widest text-white/70 mt-[0.5cqw] text-[0.85cqw]">
                    Years of<br />expertise
                  </div>
                </div>
                <div>
                  <div className="font-sans font-bold leading-none text-[2.6cqw]">50+</div>
                  <div className="uppercase tracking-widest text-white/70 mt-[0.5cqw] text-[0.85cqw]">
                    International<br />clients
                  </div>
                </div>
                <a
                  href="https://www.google.com/search?q=point+studio+bucuresti"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col justify-end group"
                  aria-label="See our Google reviews"
                >
                  <div className="flex items-center gap-[0.6cqw]">
                    <svg viewBox="0 0 48 48" className="w-[2.4cqw] h-[2.4cqw]" aria-hidden="true">
                      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/>
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
                      <path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.2-7.2 2.2-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39 16.2 43.5 24 43.5z"/>
                      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.2-.1-2.4-.4-3.5z"/>
                    </svg>
                    <div>
                      <div className="flex gap-[0.2cqw]">
                        {[0,1,2,3,4].map((i) => (
                          <Star key={i} className="w-[1cqw] h-[1cqw] fill-yellow-400 stroke-yellow-400" />
                        ))}
                      </div>
                      <div className="uppercase tracking-widest text-white/70 mt-[0.35cqw] text-[0.85cqw] group-hover:text-white transition-colors">
                        Google<br />Reviews
                      </div>
                    </div>
                  </div>
                </a>
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
      <section className="pt-10 md:pt-14 pb-16 md:pb-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-12 gap-10 items-end mb-14">
            <div className="md:col-span-5">
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">01 — Point Studio</div>
              <h2 className="font-serif italic text-5xl md:text-6xl lg:text-7xl leading-[1] text-foreground">
                The Studio
              </h2>
            </div>
            <div className="md:col-span-7 text-[15px] md:text-base leading-relaxed text-foreground/80">
              <p>
                Managed by <strong className="text-foreground">Andrei C. Radu</strong>, a graduate in Photo-Video class of the
                National Arts University, <strong className="text-foreground">Point Studio</strong> is a professional
                photography studio &amp; creative work space located in Bucharest, being part of
                Atelierele Scanteia — a creative hub of artist workspaces and galleries in the
                former communist "Casa Scanteii", in the present House of Free Press.
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
            {studioShots.map((img) => (
              <div key={img.src} className="aspect-square overflow-hidden bg-muted">
                <img
                  src={cdn(img.src, 500)}
                  alt={img.alt || "Point Studio"}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6">
          <div className="mt-14 grid md:grid-cols-2 gap-10 text-[15px] md:text-base leading-relaxed text-foreground/80">
            <p>
              Point Studio is a 200 square meters professional photo-video studio and creative
              work space created as part of Atelierele Scanteia. The space provides professional
              photo setups, equipment and specialists to accommodate all photography briefs. It
              has accessible parking, Wi-fi access and comfortable working space, which allows
              our clients to be present for the entire photo session, without missing out on
              their day at work.
            </p>
            <p>
              The fully equipped kitchen and the extensive prop room located on-site, coupled
              with long lasting relations with food stylists, prop researchers, hair stylists,
              makeup specialists and other collaborators, assure a great work experience.
            </p>
          </div>
        </div>
      </section>

      {/* What We Do */}
      <section className="bg-[#e5e5e5]">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
          <div className="grid md:grid-cols-12 gap-10 items-end mb-14">
            <div className="md:col-span-5">
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">02 — Services</div>
              <h2 className="font-serif italic text-5xl md:text-6xl lg:text-7xl leading-[1] text-foreground">
                What We Do
              </h2>
            </div>
            <div className="md:col-span-7 text-[15px] md:text-base leading-relaxed text-foreground/80">
              <p>
                We at Point Studio know how to capture the essence of every moment — starting with
                mouthwatering food photography that brings flavors to life, and extending to all
                kinds of photography to meet your unique needs. From plates to portraits,
                architecture, corporate events, industrial sites documentation or landscape, our
                lens tells your story beautifully.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {whatWeDo.map((c) => (
              <Link
                key={c.label}
                to="/work/$slug"
                params={{ slug: c.slug }}
                className="relative aspect-[3/4] overflow-hidden group block bg-muted"
              >
                {c.img && (
                  <img
                    src={cdn(c.img, 700)}
                    alt={c.label}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/45 transition-colors" />
                <div className="absolute inset-0 flex items-end p-4">
                  <div className="text-white font-sans font-medium uppercase tracking-[0.15em] text-xs md:text-sm">
                    {c.label}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-[#e5e5e5]">
        <div className="mx-auto max-w-7xl px-6 pb-16 md:pb-20">
          <div className="grid md:grid-cols-12 gap-10 items-end mb-10">
            <div className="md:col-span-5">
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">03 — Kind words</div>
              <h2 className="font-serif italic text-5xl md:text-6xl lg:text-7xl leading-[1] text-foreground">
                Testimonials
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
            {testimonials.map((t) => (
              <figure key={t.name} className="bg-background flex flex-col overflow-hidden">
                {t.video ? (
                  <button
                    type="button"
                    onClick={() => setActiveVideo(t.video!)}
                    className="relative aspect-[4/3] w-full group overflow-hidden"
                    aria-label={`Play video testimonial from ${t.name}`}
                  >
                    {t.poster && (
                      <img
                        src={cdn(t.poster, 1200)}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 md:w-6 md:h-6 text-black fill-black translate-x-0.5" />
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="p-5 md:p-6 flex flex-col gap-4 flex-1">
                    <span className="font-serif italic text-3xl md:text-4xl leading-none text-foreground/30">"</span>
                    <blockquote className="font-serif italic text-base md:text-lg leading-snug text-foreground/85">
                      {t.quote}
                    </blockquote>
                  </div>
                )}
                <figcaption className="p-5 md:p-6 pt-4 mt-auto">
                  <div className="text-sm font-medium text-foreground">{t.name}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mt-1">
                    {t.role}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {activeVideo && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setActiveVideo(null)}
        >
          <button
            type="button"
            onClick={() => setActiveVideo(null)}
            className="absolute top-6 right-6 text-white/80 hover:text-white"
            aria-label="Close video"
          >
            <X className="w-8 h-8" />
          </button>
          <div
            className="relative w-full max-w-5xl aspect-video"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={activeVideo + "?autoplay=1"}
              title="Video testimonial"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>
      )}


    </SiteLayout>
  );
}
