import { useCallback, useEffect, useRef, useState } from "react";
import { cdn, cdnSrcSet, IMAGE_QUALITY_LARGE, onTransformError } from "@/components/SiteLayout";
import { useTr } from "@/i18n";

export type ZoomLightboxImage = { src: string; alt?: string | null; title?: string | null };

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/**
 * Wanders-only fullscreen viewer: same visual language as the shared lightbox,
 * plus photographic zoom/pan. High-resolution (2400px, q=88) delivery comes
 * from the existing Cloudflare Image Transformations helpers.
 */
export function ZoomLightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: {
  images: ZoomLightboxImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const t = useTr();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const pinchRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);
  const lastTapRef = useRef(0);

  const reset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const go = useCallback(
    (delta: number) => {
      reset();
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndexChange, reset],
  );

  // Reset to fit whenever the photograph changes.
  useEffect(() => {
    reset();
  }, [index, reset]);

  // Lock background scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  // px/py are anchor coordinates relative to the container CENTER, matching the
  // image's `transform-origin: center`. Omitted anchor = zoom about the centre.
  const zoomAt = useCallback((next: number, px = 0, py = 0) => {
    setZoom((z) => {
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      const k = clamped / z;
      setOffset((o) => {
        if (clamped === MIN_ZOOM) return { x: 0, y: 0 };
        return { x: px - (px - o.x) * k, y: py - (py - o.y) * k };
      });
      return clamped;
    });
  }, []);

  const anchor = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return [0, 0] as const;
    return [clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2)] as const;
  };

  // Non-passive wheel listener so trackpad pinch does not zoom the page.
  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const rect = el.getBoundingClientRect();
      zoomAtRef.current(
        zoomRef.current * Math.exp(-dy * 0.0018),
        e.clientX - (rect.left + rect.width / 2),
        e.clientY - (rect.top + rect.height / 2),
      );
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const img = images[index];
  if (!img) return null;
  const caption = img.title || img.alt || "";

  const onPointerDown = (e: React.PointerEvent) => {
    pinchRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchRef.current.size === 2) {
      const [a, b] = [...pinchRef.current.values()];
      pinchStartRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      draggingRef.current = null;
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pinchRef.current.has(e.pointerId)) {
      pinchRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pinchRef.current.size === 2 && pinchStartRef.current) {
      const [a, b] = [...pinchRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const [ax, ay] = anchor((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomAt(pinchStartRef.current.zoom * (dist / pinchStartRef.current.dist), ax, ay);
      return;
    }
    const d = draggingRef.current;
    if (!d || d.id !== e.pointerId || zoom <= 1) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  };

  const endPointer = (e: React.PointerEvent) => {
    pinchRef.current.delete(e.pointerId);
    if (pinchRef.current.size < 2) pinchStartRef.current = null;
    const d = draggingRef.current;
    draggingRef.current = null;
    if (!d || d.id !== e.pointerId) return;
    if (d.moved) return;
    // Tap / click on the image: double-tap toggles zoom.
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      if (zoom > 1) reset();
      else zoomAt(2.5, ...anchor(e.clientX, e.clientY));
    } else {
      lastTapRef.current = now;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        className="absolute top-4 right-5 text-white text-2xl leading-none p-2 z-20"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      <button
        type="button"
        className="absolute left-2 md:left-8 text-white text-4xl p-3 z-20"
        onClick={(e) => {
          e.stopPropagation();
          go(-1);
        }}
        aria-label="Previous"
      >
        ‹
      </button>

      <div
        ref={containerRef}
        className="relative flex-1 w-full flex items-center justify-center overflow-hidden"
        style={{ touchAction: "none", cursor: zoom > 1 ? "grab" : "zoom-in" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDoubleClick={(e) => {
          if (zoom > 1) reset();
          else zoomAt(2.5, ...anchor(e.clientX, e.clientY));
        }}
      >
        <img
          key={img.src}
          // One request only: the largest useful web variant (<= 3200px long
          // edge, quality 88, format=auto, fit=scale-down so never upscaled).
          // Zooming reuses this already-loaded source.
          src={cdnFixed(img.src, LIGHTBOX_MAX_WIDTH, IMAGE_QUALITY_LARGE)}
          alt={img.alt ?? caption}
          decoding="async"
          fetchPriority="high"
          draggable={false}
          onLoad={onCurrentLoaded}

          className="max-h-[calc(100vh-9rem)] max-w-[88vw] object-contain"
          style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
            transformOrigin: "center center",
            transition: draggingRef.current ? "none" : "transform 120ms ease-out",
          }}
          onError={onTransformError}
        />
      </div>

      <button
        type="button"
        className="absolute right-2 md:right-8 text-white text-4xl p-3 z-20"
        onClick={(e) => {
          e.stopPropagation();
          go(1);
        }}
        aria-label="Next"
      >
        ›
      </button>

      {caption && (
        <div className="mt-3 max-w-[88vw] text-center text-xs tracking-wide text-white/70">
          {t(caption)}
        </div>
      )}

      <div className="mt-3 flex items-center gap-4 text-white/70 text-xs tracking-widest">
        <button
          type="button"
          className="px-2 py-1 hover:text-white"
          onClick={() => zoomAt(zoom / 1.4)}
          aria-label="Zoom out"
        >
          −
        </button>
        <button type="button" className="px-2 py-1 hover:text-white tabular-nums" onClick={reset}>
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="px-2 py-1 hover:text-white"
          onClick={() => zoomAt(zoom * 1.4)}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  );
}
