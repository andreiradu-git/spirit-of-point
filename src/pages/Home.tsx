import { SiteLayout, cdn } from "@/components/SiteLayout";
import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import home from "@/data/home.json";
import { Editable } from "@/components/Editable";
import { HeroCarousel } from "@/components/HeroCarousel";
import { EditableGallery } from "@/components/EditableGallery";
import { EditableLogoBand } from "@/components/EditableLogoBand";
import { EditableTestimonials, type Testimonial } from "@/components/EditableTestimonials";
import { useImage } from "@/hooks/use-site-images";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { useGalleryCovers } from "@/hooks/use-gallery-covers";
import { useLang, useTr } from "@/i18n";







export function Index() {
  const { settings } = useSiteSettings();
  const lang = useLang();
  const t = useTr();
  const heroSrc = useImage("hero", home[1]?.src);
  const fish = { src: heroSrc, alt: t("Point Studio food photography") };
  const fallbackLogos = home
    .filter((i) => /logo|Kaufland/i.test(i.src) && !/LOGO_PSP/i.test(i.src))
    .map((l, i) => ({ id: `fallback-${i}`, src: cdn(l.src, 200), alt: t("Client logo") }));

  const studioShots = [home[20], home[24], home[26], home[30], home[18], home[22], home[28], home[19], home[21], home[23]].filter(Boolean);

  const serviceFallbacks = [
    { src: home[22]?.src, title: "Food" },
    { src: home[24]?.src, title: "People" },
    { src: home[28]?.src, title: "Editorial" },
    { src: home[27]?.src, title: "Corporate" },
    { src: home[29]?.src, title: "Landscape" },
    { src: home[31]?.src, title: "Industrial" },
  ].filter((s) => s.src) as Array<{ src: string; title: string }>;

  const { data: galleryCovers } = useGalleryCovers();

  const serviceSlug = (title: string) =>
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const testimonialFallback: Testimonial[] = [
    {
      id: "t1",
      kind: "text",
      quote:
        "Working with Point Studio was a game-changer. Andrei's eye for detail and technical precision brought our product line to life beyond what we imagined.",
      name: "Ana Popescu",
      role: "Brand Manager, Lidl România",
    },
    {
      id: "t2",
      kind: "video",
      video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      poster: home[5]?.src,
      name: "Mihai Ionescu",
      role: "Marketing Director, Kaufland",
    },
    {
      id: "t3",
      kind: "text",
      quote:
        "A rare mix of craft, patience and vision. Andrei understood our brief instantly and translated it into images that sell.",
      name: "Elena Georgescu",
      role: "Creative Lead, Carrefour",
    },
    {
      id: "t4",
      kind: "text",
      quote:
        "Fast, professional and incredibly creative. The team delivered visuals that elevated our entire campaign.",
      name: "Radu Dumitrescu",
      role: "CEO, Fresh Market",
    },
  ];


  return (
    <SiteLayout transparentHeader headerTone="light">
      {/* Hero — full-width carousel (images + video), CMS-managed */}
      <section className="relative w-full bg-white">
        <div className="relative w-full @container">
          <HeroCarousel fallbackSrc={fish.src} fallbackAlt={fish.alt} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent pointer-events-none" />
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="mx-auto max-w-7xl h-full px-3 sm:px-6 pt-[max(4.5rem,7cqw)] sm:pt-[max(5.5rem,9cqw)] md:pt-[max(6rem,9cqw)] pb-[2cqw] sm:pb-[3cqw] flex flex-col justify-between">
              <div className="max-w-[70%] sm:max-w-[65%] md:max-w-[60%] text-white pointer-events-auto">
                <Editable
                  as="h1"
                  id="hero.title"
                  multiline
                  className="font-sans font-bold uppercase tracking-tight leading-[1.02] text-[clamp(0.6rem,2.8cqw,3.2rem)] block"
                >
                  Photo-Video Studio and Creative Workspace.
                </Editable>
                <Editable
                  as="p"
                  id="hero.subtitle"
                  multiline
                  className="mt-[0.6cqw] text-white/85 leading-[1.12] text-[clamp(0.42rem,1.2cqw,1.15rem)] block"
                >
                  We blend creativity with technical expertise and a deep commitment to quality and thats how we transform your ideas into stunning visuals that captivate and sell.
                </Editable>
                <Editable
                  as="p"
                  id="hero.cta"
                  className="mt-[0.6cqw] font-sans font-bold uppercase tracking-tight leading-tight text-[clamp(0.48rem,1.55cqw,1.5rem)] block"
                >
                  Let's create toghether unforgetable images!
                </Editable>
              </div>



              <div className="flex gap-[3cqw] text-white">
                <div>
                  <Editable as="div" id="hero.stat1.value" className="font-sans font-bold leading-none text-[clamp(0.9rem,2.6cqw,2.5rem)]">
                    10+
                  </Editable>
                  <Editable as="div" id="hero.stat1.label" multiline className="uppercase tracking-widest text-white/70 mt-[0.5cqw] text-[clamp(0.45rem,0.85cqw,0.75rem)] whitespace-pre-line">
                    {"Years of\nexpertise"}
                  </Editable>
                </div>
                <div>
                  <Editable as="div" id="hero.stat2.value" className="font-sans font-bold leading-none text-[clamp(0.9rem,2.6cqw,2.5rem)]">
                    50+
                  </Editable>
                  <Editable as="div" id="hero.stat2.label" multiline className="uppercase tracking-widest text-white/70 mt-[0.5cqw] text-[clamp(0.45rem,0.85cqw,0.75rem)] whitespace-pre-line">
                    {"International\nclients"}
                  </Editable>
                </div>
                <a
                  href="https://www.google.com/search?q=point+studio+bucuresti"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col justify-end group pointer-events-auto"
                  aria-label={t("See our Google reviews")}
                >
                  <div className="flex items-center gap-[0.6cqw]">
                    <svg viewBox="0 0 48 48" className="w-[clamp(0.9rem,2.4cqw,2rem)] h-[clamp(0.9rem,2.4cqw,2rem)]" aria-hidden="true">
                      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/>
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
                      <path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.2-7.2 2.2-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39 16.2 43.5 24 43.5z"/>
                      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.2-.1-2.4-.4-3.5z"/>
                    </svg>
                    <div>
                      <div className="flex gap-[0.2cqw]">
                        {[0,1,2,3,4].map((i) => (
                          <Star key={i} className="w-[clamp(0.4rem,1cqw,0.9rem)] h-[clamp(0.4rem,1cqw,0.9rem)] fill-yellow-400 stroke-yellow-400" />
                        ))}
                      </div>
                      <div className="uppercase tracking-widest text-white/70 mt-[0.35cqw] text-[clamp(0.45rem,0.85cqw,0.75rem)] group-hover:text-white transition-colors">
                        Google<br />{t("Reviews")}
                      </div>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          </div>


        </div>
      </section>


      {/* Client logos band — editable, responsive to count */}
      <EditableLogoBand fallback={fallbackLogos} />



      {/* The Studio */}
      <section className="pt-10 md:pt-14 pb-16 md:pb-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-12 gap-10 items-end mb-14">
            <div className="md:col-span-5">
              <Editable as="div" id="studio.eyebrow" className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3 block">
                01 — Point Studio
              </Editable>
              <Editable as="h2" id="studio.title" className="font-serif italic text-5xl md:text-6xl lg:text-7xl leading-[1] text-foreground block">
                The Studio
              </Editable>
            </div>
            <div className="md:col-span-7 text-[15px] md:text-base leading-relaxed text-foreground/80">
              <Editable as="p" id="studio.intro" multiline>
                Managed by Andrei C. Radu, a graduate in Photo-Video class of the National Arts University, Point Studio is a professional photography studio & creative work space located in Bucharest, being part of Atelierele Scanteia — a creative hub of artist workspaces and galleries in the former communist "Casa Scanteii", in the present House of Free Press.
              </Editable>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6">
          <EditableGallery
            slug="studio"
            fallbackImages={studioShots}
            columns={6}
            aspect="square"
            lightbox
          />
        </div>

        <div className="mx-auto max-w-7xl px-6">
          <div className="mt-14 grid md:grid-cols-2 gap-10 text-[15px] md:text-base leading-relaxed text-foreground/80">
            <Editable as="p" id="studio.body1" multiline>
              Point Studio is a 200 square meters professional photo-video studio and creative work space created as part of Atelierele Scanteia. The space provides professional photo setups, equipment and specialists to accommodate all photography briefs. It has accessible parking, Wi-fi access and comfortable working space, which allows our clients to be present for the entire photo session, without missing out on their day at work.
            </Editable>
            <Editable as="p" id="studio.body2" multiline>
              The fully equipped kitchen and the extensive prop room located on-site, coupled with long lasting relations with food stylists, prop researchers, hair stylists, makeup specialists and other collaborators, assure a great work experience.
            </Editable>
          </div>
        </div>

      </section>

      {/* What We Do */}
      <section className="bg-[#e5e5e5]">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
          <div className="grid md:grid-cols-12 gap-10 items-end mb-14">
            <div className="md:col-span-5">
              <Editable as="div" id="services.eyebrow" className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3 block">
                02 — Services
              </Editable>
              <Editable as="h2" id="services.title" className="font-serif italic text-5xl md:text-6xl lg:text-7xl leading-[1] text-foreground block">
                What We Do
              </Editable>
            </div>
            <div className="md:col-span-7 text-[15px] md:text-base leading-relaxed text-foreground/80">
              <Editable as="p" id="services.intro" multiline>
                We at Point Studio know how to capture the essence of every moment — starting with mouthwatering food photography that brings flavors to life, and extending to all kinds of photography to meet your unique needs. From plates to portraits, architecture, corporate events, industrial sites documentation or landscape, our lens tells your story beautifully.
              </Editable>
            </div>
          </div>

          <EditableGallery
            slug="services"
            fallbackImages={serviceFallbacks}
            columns={6}
            aspect="portrait"
            renderItem={(img, { editable }) => (
              <Link
                to={(lang === "ro" ? "/ro/work/$slug" : "/work/$slug") as "/work/$slug"}
                params={{ slug: serviceSlug(img.title || "") }}
                className="relative aspect-[3/4] overflow-hidden group block bg-muted"
              >
                <img
                  src={cdn(galleryCovers?.[serviceSlug(img.title || "")] ?? img.src, 700)}
                  alt={img.alt ?? img.title ?? ""}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/45 transition-colors" />
                <div className="absolute inset-0 flex items-end p-4">
                  <div className="text-white font-sans font-medium uppercase tracking-[0.15em] text-xs md:text-sm">
                    {t(img.title ?? "")}
                  </div>
                </div>
              </Link>
            )}
          />
        </div>
      </section>

      {/* Testimonials */}
      {settings.showTestimonials && (
        <section className="bg-[#e5e5e5]">
          <div className="mx-auto max-w-7xl px-6 pb-16 md:pb-20">
            <div className="grid md:grid-cols-12 gap-10 items-end mb-10">
              <div className="md:col-span-5">
                <Editable as="div" id="testimonials.eyebrow" className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3 block">
                  03 — Kind words
                </Editable>
                <Editable as="h2" id="testimonials.title" className="font-serif italic text-5xl md:text-6xl lg:text-7xl leading-[1] text-foreground block">
                  Testimonials
                </Editable>

              </div>
            </div>
            <EditableTestimonials fallback={testimonialFallback} />
          </div>
        </section>
      )}




    </SiteLayout>
  );
}
