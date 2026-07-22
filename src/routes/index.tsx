import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, cdn } from "@/components/SiteLayout";
import { Gallery } from "@/components/Gallery";
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
      { property: "og:image", content: cdn(home[1].src, 1600) },
      { name: "twitter:image", content: cdn(home[1].src, 1600) },
    ],
  }),
});

function Index() {
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

  const testimonials = [
    {
      quote:
        "Working with Point Studio was a game-changer. Andrei's eye for detail and technical precision brought our product line to life beyond what we imagined.",
      name: "Ana Popescu",
      role: "Brand Manager, Lidl România",
    },
    {
      quote:
        "The professionalism and creativity at Point Studio are unmatched. Every shoot delivers exactly the mood and quality our campaigns need.",
      name: "Mihai Ionescu",
      role: "Marketing Director, Kaufland",
    },
    {
      quote:
        "A rare mix of craft, patience and vision. Andrei understood our brief instantly and translated it into images that sell.",
      name: "Elena Georgescu",
      role: "Creative Lead, Carrefour",
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
            <div className="mx-auto max-w-7xl h-full px-6 pt-[max(64px,10cqw)] pb-[4cqw] flex flex-col justify-between">
              <div className="max-w-[58%] text-white">
                <h1 className="font-sans font-bold uppercase tracking-tight leading-[1.05] text-[clamp(14px,3cqw,44px)]">
                  Photo-Video Studio and<br />Creative Workspace.
                </h1>
                <p className="mt-[1.2cqw] text-white/85 leading-snug text-[clamp(9px,1.05cqw,15px)]">
                  We blend creativity with technical expertise and a deep commitment to
                  quality and thats how we transform your ideas into stunning visuals
                  that captivate and sell.
                </p>
                <p className="mt-[1.2cqw] font-sans font-bold uppercase tracking-tight leading-tight text-[clamp(10px,1.4cqw,20px)]">
                  Let's create toghether<br />unforgetable images!
                </p>
              </div>
              <div className="flex gap-[3cqw] text-white">
                <div>
                  <div className="font-sans font-bold leading-none text-[clamp(14px,2.3cqw,34px)]">10+</div>
                  <div className="uppercase tracking-widest text-white/70 mt-[0.5cqw] text-[clamp(6px,0.65cqw,10px)]">
                    Years of<br />expertise
                  </div>
                </div>
                <div>
                  <div className="font-sans font-bold leading-none text-[clamp(14px,2.3cqw,34px)]">50+</div>
                  <div className="uppercase tracking-widest text-white/70 mt-[0.5cqw] text-[clamp(6px,0.65cqw,10px)]">
                    International<br />clients
                  </div>
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
      <section className="py-20 md:py-28">
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

        <div className="px-4 md:px-6">
          <Gallery images={studioShots} columns={4} />
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
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
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

    </SiteLayout>
  );
}
