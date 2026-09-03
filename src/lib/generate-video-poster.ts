// Browser-side helpers to derive a poster image + metadata from any video URL.
// Supports YouTube, Vimeo (via oEmbed) and direct MP4/WebM URLs (canvas frame
// capture). Returns nulls gracefully on failure so callers can fall back to a
// configurable placeholder.

/** Synchronous best-effort poster for a video URL (currently YouTube only).
 *  Returns null when no thumbnail can be derived without a network call. */
export function derivePosterSync(url: string): string | null {
  if (!url) return null;
  const yt = ytMatch(url);
  return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null;
}

export type PosterResult = {
  posterUrl: string | null;
  width?: number;
  height?: number;
  duration?: number;
  /** True when the poster came from a browser-side frame capture and needs to
   *  be uploaded by the caller. When false, `posterUrl` is already a hosted
   *  URL (YouTube/Vimeo/CDN) or null. */
  needsUpload?: boolean;
  blob?: Blob;
};

function ytMatch(url: string) {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  return m?.[1] ?? null;
}
function vimeoMatch(url: string) {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m?.[1] ?? null;
}

async function captureFrame(src: string, timeSec = 1.5): Promise<PosterResult | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = src;
    let settled = false;
    const done = (v: PosterResult | null) => {
      if (settled) return;
      settled = true;
      try {
        video.removeAttribute("src");
        video.load();
      } catch {}
      resolve(v);
    };
    const timer = window.setTimeout(() => done(null), 15000);
    video.addEventListener("error", () => {
      window.clearTimeout(timer);
      done(null);
    });
    video.addEventListener("loadedmetadata", () => {
      const t = isFinite(video.duration)
        ? Math.min(timeSec, Math.max(0.1, video.duration - 0.1))
        : timeSec;
      try {
        video.currentTime = t;
      } catch {
        done(null);
      }
    });
    video.addEventListener("seeked", async () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return done(null);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return done(null);
        ctx.drawImage(video, 0, 0, w, h);
        const blob: Blob | null = await new Promise((r) =>
          canvas.toBlob(r, "image/webp", 0.85),
        );
        if (!blob) return done(null);
        window.clearTimeout(timer);
        done({
          posterUrl: null,
          width: w,
          height: h,
          duration: isFinite(video.duration) ? video.duration : undefined,
          needsUpload: true,
          blob,
        });
      } catch {
        done(null);
      }
    });
  });
}

export async function derivePoster(videoUrl: string): Promise<PosterResult> {
  if (!videoUrl) return { posterUrl: null };

  const yt = ytMatch(videoUrl);
  if (yt) {
    return { posterUrl: `https://i.ytimg.com/vi/${yt}/maxresdefault.jpg` };
  }

  const vm = vimeoMatch(videoUrl);
  if (vm) {
    try {
      const res = await fetch(
        `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vm}`,
      );
      if (res.ok) {
        const j = (await res.json()) as {
          thumbnail_url?: string;
          width?: number;
          height?: number;
          duration?: number;
        };
        if (j.thumbnail_url) {
          // Vimeo returns a low-res thumbnail by default. Upscale via URL swap.
          const hi = j.thumbnail_url.replace(/_\d+x\d+(?=\.[a-z]+$)/, "_1280");
          return {
            posterUrl: hi,
            width: j.width,
            height: j.height,
            duration: j.duration,
          };
        }
      }
    } catch {
      // fall through to placeholder
    }
    return { posterUrl: null };
  }

  // Direct file — try frame capture
  const framed = await captureFrame(videoUrl, 1.5);
  if (framed) return framed;
  return { posterUrl: null };
}
