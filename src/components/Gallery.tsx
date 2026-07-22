import { useEffect, useState } from "react";
import { cdn } from "./SiteLayout";

type Img = { src: string; alt: string };

export function Gallery({ images: allImages, columns = 3 }: { images: Img[]; columns?: number }) {
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

  const colClass =
    columns === 2
      ? "grid-cols-2"
      : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <>
      <div className={`grid ${colClass} gap-3`}>
        {images.map((img, i) => (
          <button
            key={img.src}
            onClick={() => setActive(i)}
            className="block w-full overflow-hidden bg-muted group aspect-[4/5]"
          >
            <img
              src={cdn(img.src, 1000)}
              alt={img.alt || "Point Studio photograph"}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </button>
        ))}
      </div>

      {active !== null && (
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
      )}
    </>
  );
}
