import { useRef } from "react";
import { SiteLayout, cdn, cdnSrcSet, onTransformError } from "./SiteLayout";
import { EditableGallery } from "./EditableGallery";
import { EditableLogoBand } from "./EditableLogoBand";
import { useGallery } from "@/hooks/use-gallery";
import { Editable } from "./Editable";
import { GallerySeoSection } from "./GallerySeoSection";
import { useGalleryCover } from "@/hooks/use-gallery-covers";
import { useLang, useTr } from "@/i18n";

type Img = { src: string; alt?: string };

export function PortfolioPage({
  slug,
  tagline,
  taglineId,
  fallbackImages,
  showStrip = false,
  showLogos = false,
  galleryLayout = "masonry",
}: {
  slug: string;
  tagline: string;
  taglineId?: string;
  fallbackImages: Img[];
  showStrip?: boolean;
  showLogos?: boolean;
  galleryLayout?: "grid" | "masonry" | "stacked" | "archive";
}) {
  const lang = useLang();
  const t = useTr();
  const { data: gallery } = useGallery(slug);
  const cover = useGalleryCover(slug);
  const rawImages: Img[] =
    gallery?.images.map((img) => ({ src: img.src, alt: img.alt ?? undefined })) ??
    fallbackImages.filter((i) => !/LOGO_PSP/i.test(i.src));
  // The chosen cover leads the page; otherwise the first uploaded image does.
  const images: Img[] = cover
    ? [...rawImages].sort((a, b) => Number(b.src === cover) - Number(a.src === cover))
    : rawImages;

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
          {taglineId ? (
            <Editable id={taglineId} className="inline">
              {tagline}
            </Editable>
          ) : (
            t(tagline)
          )}
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
                  srcSet={cdnSrcSet(img.src, [400, 800, 1200, 1600])}
                  sizes="(min-width:768px) 52vh, 41vh"
                  alt={img.alt || t("Point Studio photograph")}
                  loading="lazy"
                  className="h-full w-auto object-cover"
                  onError={onTransformError}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => scrollBy(-1)}
            aria-label={t("Previous")}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black text-2xl shadow hover:bg-white"
          >
            ‹
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label={t("Next")}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black text-2xl shadow hover:bg-white"
          >
            ›
          </button>
        </section>
      )}

      {showLogos && <EditableLogoBand />}

      {/* Full gallery */}
      {galleryLayout === "stacked" ? (
        <div className="w-full pt-6 md:pt-10 pb-24">
          <EditableGallery
            slug={slug}
            fallbackImages={fallbackImages}
            layout="stacked"
            lightbox
          />
        </div>
      ) : galleryLayout === "archive" ? (
        <div className="mx-auto max-w-7xl px-6 pt-2 md:pt-6 pb-24">
          <EditableGallery
            slug={slug}
            fallbackImages={fallbackImages}
            layout="grid"
            columns={4}
            archive
            lightbox
          />
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-6 pt-10 md:pt-14 pb-24">
          <EditableGallery
            slug={slug}
            fallbackImages={fallbackImages}
            aspect="auto"
            layout="masonry"
            lightbox
          />
        </div>
      )}

      <GallerySeoSection
        slug={slug}
        lang={lang}
        title={gallery?.title || t(tagline)}
        images={images}
      />
    </SiteLayout>
  );
}
