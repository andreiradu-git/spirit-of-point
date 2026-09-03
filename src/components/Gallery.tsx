import { useEffect, useState } from "react";
import { CrossfadeImage } from "./CrossfadeImage";
import { cdn, cdnSrcSet, IMAGE_QUALITY_LARGE, onTransformError } from "./SiteLayout";
import { useTr } from "@/i18n";

type Img = { src: string; alt: string };

export function Gallery({
  images: allImages,
  columns = 3,
  layout = "grid",
}: {
  images: Img[];
  columns?: number;
  layout?: "grid" | "masonry" | "stacked";
}) {
  const t = useTr();
  const images = allImages.filter((i) => !/LOGO_PSP/i.test(i.src));
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
      if (e.key === "ArrowRight") setActive((a) => (a === null ? a : (a + 1) % images.length));
      if (e.key === "ArrowLeft")
        setActive((a) => (a === null ? a : (a - 1 + images.length) % images.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, images.length]);

  if (layout === "stacked") {
    return (
      <>
        <div className="flex flex-col">
          {images.map((img, i) => (
            <button
              key={img.src}
              onClick={() => setActive(i)}
              className="block w-full overflow-hidden bg-muted"
            >
              <img
                src={cdn(img.src, 1200)}
                srcSet={cdnSrcSet(img.src)}
                sizes="100vw"
                alt={img.alt || "Point Studio photograph"}
                loading="lazy"
                decoding="async"
                className="block w-full h-auto"
                onError={onTransformError}
              />
            </button>
          ))}
        </div>
        {renderLightbox()}
      </>
    );
  }

  if (layout === "masonry") {
    const numColsDesktop = columns === 2 ? 2 : 4;
    const numColsTablet = columns === 2 ? 2 : 3;
    const numColsMobile = 2;

    const distribute = (n: number) => {
      const cols: { img: Img; i: number }[][] = Array.from({ length: n }, () => []);
      images.forEach((img, i) => cols[i % n].push({ img, i }));
      return cols;
    };

    const renderCols = (n: number, cls: string) => (
      <div className={`${cls} grid gap-3`} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {distribute(n).map((col, ci) => (
          <div key={ci} className="flex flex-col gap-3">
            {col.map(({ img, i }) => (
              <button
                key={img.src}
                onClick={() => setActive(i)}
                className="block w-full overflow-hidden bg-muted group"
              >
                <img
                  src={cdn(img.src, 500)}
                  srcSet={cdnSrcSet(img.src, [400, 800, 1200, 1600])}
                  sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
                  alt={img.alt || "Point Studio photograph"}
                  loading="lazy"
                  decoding="async"
                  className="block w-full h-auto transition-transform duration-500 group-hover:scale-[1.02]"
                  onError={onTransformError}
                />
              </button>
            ))}
          </div>
        ))}
      </div>
    );

    return (
      <>
        {renderCols(numColsMobile, "md:hidden")}
        {renderCols(numColsTablet, "hidden md:grid lg:hidden")}
        {renderCols(numColsDesktop, "hidden lg:grid")}
        {renderLightbox()}
      </>
    );
  }



  const colClass =
    columns === 2
      ? "grid-cols-2"
      : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <>
      <div className={`grid ${colClass} gap-3 items-start`}>
        {images.map((img, i) => (
          <button
            key={img.src}
            onClick={() => setActive(i)}
            className="block w-full self-start overflow-hidden bg-muted group"
          >
            <img
              src={cdn(img.src, 500)}
              srcSet={cdnSrcSet(img.src, [400, 800, 1200, 1600])}
              sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
              alt={img.alt || "Point Studio photograph"}
              loading="lazy"
              decoding="async"
              className="block w-full h-auto transition-transform duration-500 group-hover:scale-[1.02]"
              onError={onTransformError}
            />
          </button>
        ))}
      </div>
      {renderLightbox()}
    </>
  );

  function renderLightbox() {
    if (active === null) return null;
    return (
      <div
        className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
        onClick={() => setActive(null)}
      >
        <button
          className="absolute top-4 right-6 text-white text-sm uppercase tracking-widest"
          onClick={() => setActive(null)}
        >
          Close
        </button>
        <button
          className="absolute left-4 md:left-8 text-white text-3xl px-3"
          onClick={(e) => {
            e.stopPropagation();
            setActive((a) => (a === null ? a : (a - 1 + images.length) % images.length));
          }}
          aria-label={t("Previous")}
        >
          ‹
        </button>
        <CrossfadeImage
          src={cdn(images[active].src, 2400, IMAGE_QUALITY_LARGE)}
          srcSet={cdnSrcSet(images[active].src, [800, 1200, 1600, 2400], IMAGE_QUALITY_LARGE)}
          sizes="(min-width:1024px) 90vw, 100vw"
          alt={images[active].alt || ""}
          preload={[1, -1]
            .map((d) => images[(active + d + images.length) % images.length])
            .filter((n) => n && n !== images[active])
            .map((n) => ({
              src: cdn(n.src, 2400, IMAGE_QUALITY_LARGE),
              srcSet: cdnSrcSet(n.src, [800, 1200, 1600, 2400], IMAGE_QUALITY_LARGE),
              sizes: "(min-width:1024px) 90vw, 100vw",
            }))}
          stageClassName="w-[90vw] h-[90vh]"
          imgClassName="max-h-full max-w-full w-auto h-auto object-contain"
          onClick={(e) => e.stopPropagation()}
          onError={onTransformError}
        />
        <button
          className="absolute right-4 md:right-8 text-white text-3xl px-3"
          onClick={(e) => {
            e.stopPropagation();
            setActive((a) => (a === null ? a : (a + 1) % images.length));
          }}
          aria-label={t("Next")}
        >
          ›
        </button>
      </div>
    );
  }
}

