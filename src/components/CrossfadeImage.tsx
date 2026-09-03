import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Photographic crossfade between two images inside a fixed stage.
 *
 * - The stage never moves or resizes; both layers are absolutely positioned and
 *   contained, so portrait/landscape changes cause no layout shift.
 * - The transition only starts once the destination image has finished loading
 *   (it is preloaded off-screen), so there is never a blank frame.
 * - Neighbour images are preloaded opportunistically after the current one
 *   finishes loading.
 * - Only `opacity` animates (compositor friendly). Reduced motion gets a very
 *   short fade.
 */

export const CROSSFADE_MS = 600;
export const CROSSFADE_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

type Source = { src: string; srcSet?: string; sizes?: string };
type Layer = Source & { id: number };

function preloadSource({ src, srcSet, sizes }: Source) {
  const img = new Image();
  img.decoding = "async";
  if (srcSet) img.srcset = srcSet;
  if (sizes) img.sizes = sizes;
  img.src = src;
  return img;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

function connectionAllowsPrefetch() {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const c = nav.connection;
  return !(c?.saveData || (c?.effectiveType && !/4g/.test(c.effectiveType)));
}

export function CrossfadeImage({
  src,
  srcSet,
  sizes,
  alt,
  stageClassName = "",
  stageStyle,
  innerStyle,
  imgClassName = "max-w-full max-h-full w-auto h-auto object-contain",
  imgStyle,
  preload = [],
  onError,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDoubleClick,
  onClick,
}: {
  src: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  stageClassName?: string;
  stageStyle?: React.CSSProperties;
  /** Applied to the layer wrapper (e.g. zoom/pan transform). */
  innerStyle?: React.CSSProperties;
  imgClassName?: string;
  imgStyle?: React.CSSProperties;
  /** Neighbour sources, prefetched after the current image has loaded. */
  preload?: Source[];
  onError?: React.ReactEventHandler<HTMLImageElement>;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
  /** Attached to the visible image itself, not the stage. */
  onClick?: React.MouseEventHandler<HTMLImageElement>;
}) {
  const reduced = usePrefersReducedMotion();
  const duration = reduced ? 80 : CROSSFADE_MS;

  const [shown, setShown] = useState<Layer>({ id: 0, src, srcSet, sizes });
  const [outgoing, setOutgoing] = useState<Layer | null>(null);
  // 0 = incoming hidden / outgoing visible, 1 = fully swapped.
  const [progress, setProgress] = useState(1);
  const tokenRef = useRef(0);
  const idRef = useRef(0);

  useEffect(() => {
    if (src === shown.src) return;
    const token = ++tokenRef.current;
    let cancelled = false;
    const pre = preloadSource({ src, srcSet, sizes });

    const start = () => {
      if (cancelled || token !== tokenRef.current) return;
      idRef.current += 1;
      // Only ever keep one outgoing layer: rapid navigation replaces it.
      setOutgoing((prev) => (prev && prev.id === shown.id ? prev : shown));
      setShown({ id: idRef.current, src, srcSet, sizes });
      setProgress(0);
    };

    if (pre.complete) {
      start();
    } else {
      pre.addEventListener("load", start, { once: true });
      pre.addEventListener("error", start, { once: true });
    }
    return () => {
      cancelled = true;
      pre.removeEventListener("load", start);
      pre.removeEventListener("error", start);
    };
  }, [src, srcSet, sizes, shown]);

  // Kick the crossfade one painted frame after both layers are mounted, so the
  // incoming layer always animates from 0 instead of appearing instantly.
  useEffect(() => {
    if (progress !== 0) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setProgress(1));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [progress]);

  // Drop the outgoing layer once the crossfade has finished.
  useEffect(() => {
    if (progress !== 1 || !outgoing) return;
    const id = window.setTimeout(() => setOutgoing(null), duration + 60);
    return () => window.clearTimeout(id);
  }, [progress, outgoing, duration]);

  const onCurrentLoad = useCallback(() => {
    if (!preload.length || !connectionAllowsPrefetch()) return;
    for (const n of preload) {
      if (!n?.src || n.src === shown.src) continue;
      preloadSource(n);
    }
  }, [preload, shown.src]);

  const layerClass = "absolute inset-0 flex items-center justify-center pointer-events-none";
  const transition = `opacity ${duration}ms ${CROSSFADE_EASE}`;

  return (
    <div
      className={`relative ${stageClassName}`}
      style={stageStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
    >
      <div className="absolute inset-0" style={innerStyle}>
        <div className={layerClass} style={{ opacity: progress, transition }}>
          <img
            key={shown.id}
            src={shown.src}
            srcSet={shown.srcSet}
            sizes={shown.sizes}
            alt={alt}
            decoding="async"
            fetchPriority="high"
            draggable={false}
            onLoad={onCurrentLoad}
            onError={onError}
            onClick={onClick}
            className={imgClassName}
            style={onClick ? { ...imgStyle, pointerEvents: "auto" } : imgStyle}
          />
        </div>
        {outgoing && (
          <div className={`${layerClass} z-10`} style={{ opacity: 1 - progress, transition }} aria-hidden>
            <img
              key={outgoing.id}
              src={outgoing.src}
              srcSet={outgoing.srcSet}
              sizes={outgoing.sizes}
              alt=""
              decoding="async"
              draggable={false}
              className={imgClassName}
              style={imgStyle}
            />
          </div>
        )}
      </div>
    </div>
  );
}
