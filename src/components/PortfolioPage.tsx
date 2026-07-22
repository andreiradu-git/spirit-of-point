import { useRef } from "react";
import { SiteLayout, cdn } from "./SiteLayout";
import { Gallery } from "./Gallery";
import { ClientLogos } from "./ClientLogos";

type Img = { src: string; alt: string };

export function PortfolioPage({
  tagline,
  images: allImages,
  showStrip = false,
  showLogos = false,
  galleryLayout = "masonry",
}: {
  tagline: string;
  images: Img[];
  showStrip?: boolean;
  showLogos?: boolean;
  galleryLayout?: "grid" | "masonry" | "stacked";
}) {
  const images = allImages.filter((i) => !/LOGO_PSP/i.test(i.src));

  const stripRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <SiteLayout>
      <div className="pt-10 md:pt-14 pb-10 md:pb-16">
        <p className="text-center text-[11px] md:text-xs uppercase tracking-[0.35em] md:tracking-[0.5em] text-foreground/70 px-4">
          {tagline}
        </p>
      </div>

      {showStrip && (
        <section className="relative bg-background">
          <div
            ref={stripRef}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth px-6 pb-6"
            style={{ scrollbarWidth: "thin" }}
          >
            {images.map((img) => (
              <div
                key={"strip-" + img.src}
                className="shrink-0 snap-start h-[41vh] md:h-[52vh] bg-muted"
              >
                <img
                  src={cdn(img.src, 1200)}
                  alt={img.alt || "Point Studio photograph"}
                  loading="lazy"
                  className="h-full w-auto object-cover"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Previous"
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black text-2xl shadow hover:bg-white"
          >
            ‹
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label="Next"
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black text-2xl shadow hover:bg-white"
          >
            ›
          </button>
        </section>
      )}

      {showLogos && <ClientLogos />}

      {/* Full grid gallery */}
      <div className="mx-auto max-w-7xl px-6 pt-10 md:pt-14 pb-24">
        <Gallery images={images} columns={3} layout={galleryLayout} />
      </div>
    </SiteLayout>
  );
}

