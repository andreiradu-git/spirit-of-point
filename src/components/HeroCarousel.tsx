import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cdn, cdnSrcSet } from "@/components/SiteLayout";
import {
  useHeroItems,
  useHeroSettings,
  DEFAULT_HERO_CROP,
  HERO_ASPECT,
  type HeroItem,
} from "@/hooks/use-hero-gallery";


function embedUrl(url: string) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

type Props = {
  fallbackSrc: string;
  fallbackAlt?: string;
  children?: React.ReactNode;
};

export function HeroCarousel({ fallbackSrc, fallbackAlt = "", children }: Props) {
  const { data: stored } = useHeroItems();
  const { data: settings } = useHeroSettings();

  const items: HeroItem[] = useMemo(() => {
    if (stored && stored.length) return stored;
    return [{ id: "fallback", kind: "image", src: fallbackSrc, alt: fallbackAlt }];
  }, [stored, fallbackSrc, fallbackAlt]);

  const mode = settings?.mode ?? "auto";
  const interval = settings?.interval ?? 4;

  const [index, setIndex] = useState(0);
  const [videoBusy, setVideoBusy] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (index > items.length - 1) setIndex(0);
  }, [items.length, index]);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + items.length) % items.length);
    },
    [items.length],
  );

  const active = items[index] ?? items[0];
  const activeIsEmbed = active?.kind === "video" && !!embedUrl(active.src);

  useEffect(() => {
    if (mode !== "auto" || items.length < 2) return;
    if (videoBusy || activeIsEmbed) return;
    const t = window.setInterval(() => go(1), interval * 1000);
    return () => window.clearInterval(t);
  }, [mode, interval, items.length, videoBusy, activeIsEmbed, go, index]);

  const onClickSlide = () => {
    if (mode === "click" && items.length > 1) go(1);
  };

  return (
    <div
      className="relative w-full select-none"
      style={{ aspectRatio: HERO_ASPECT }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        if (start == null || items.length < 2) return;
        const dx = (e.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
    >
      <div
        className={`absolute inset-0 overflow-hidden ${mode === "click" && items.length > 1 ? "cursor-pointer" : ""}`}
        onClick={onClickSlide}
      >
        {items.map((item, i) => {
          const isActive = i === index;
          const isNext = i === (index + 1) % items.length;
          const embed = item.kind === "video" ? embedUrl(item.src) : null;
          const crop = { ...DEFAULT_HERO_CROP, ...(item.crop ?? {}) };
          const mediaStyle = {
            objectPosition: `${crop.x}% ${crop.y}%`,
            transform: crop.zoom !== 1 ? `scale(${crop.zoom})` : undefined,
            transformOrigin: `${crop.x}% ${crop.y}%`,
          } as const;
          return (
            <div
              key={item.id}
              className={`absolute inset-0 overflow-hidden transition-opacity duration-700 ease-out ${
                isActive ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              aria-hidden={!isActive}
            >
              {item.kind === "image" ? (
                <img
                  src={cdn(item.src, 2400)}
                  srcSet={cdnSrcSet(item.src, [800, 1200, 1600, 2400])}
                  sizes="100vw"
                  alt={item.alt ?? ""}
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : isNext ? "low" : "auto"}
                  decoding="async"
                  style={mediaStyle}
                  className="w-full h-full object-cover"
                />
              ) : embed ? (
                isActive || isNext ? (
                  <iframe
                    src={embed}
                    title="Hero video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    className="w-full h-full"
                  />
                ) : null
              ) : (
                <video
                  src={item.src}
                  poster={item.poster ? cdn(item.poster, 1600) : undefined}
                  aria-label={item.alt || undefined}
                  controls
                  playsInline
                  preload={isActive || isNext ? "metadata" : "none"}
                  style={mediaStyle}
                  className="w-full h-full object-cover"
                  onPlay={() => setVideoBusy(true)}
                  onPause={() => setVideoBusy(false)}
                  onEnded={() => {
                    setVideoBusy(false);
                    if (mode === "auto") go(1);
                  }}
                />
              )}

            </div>
          );
        })}
      </div>

      {children}

      {items.length > 1 && mode !== "static" && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 flex gap-2">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
