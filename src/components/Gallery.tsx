import { useEffect, useState } from "react";
import { cdn } from "./SiteLayout";

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
                src={cdn(img.src, 2000)}
                alt={img.alt || "Point Studio photograph"}
                loading="lazy"
                className="block w-full h-auto"
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
                  src={cdn(img.src, 1000)}
                  alt={img.alt || "Point Studio photograph"}
                  loading="lazy"
                  className="block w-full h-auto transition-transform duration-500 group-hover:scale-[1.02]"
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
              src={cdn(img.src, 1000)}
              alt={img.alt || "Point Studio photograph"}
              loading="lazy"
              className="block w-full h-auto transition-transform duration-500 group-hover:scale-[1.02]"
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
          aria-label="Previous"
        >
          ‹
        </button>
        <img
          src={cdn(images[active].src, 2000)}
          alt={images[active].alt || ""}
          className="max-h-[90vh] max-w-[90vw] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          className="absolute right-4 md:right-8 text-white text-3xl px-3"
          onClick={(e) => {
            e.stopPropagation();
            setActive((a) => (a === null ? a : (a + 1) % images.length));
          }}
          aria-label="Next"
        >
          ›
        </button>
      </div>
    );
  }
}

