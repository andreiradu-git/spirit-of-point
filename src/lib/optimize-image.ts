// Shared browser-side image optimization pipeline.
// Used by both the automatic post-upload step and the manual "Optimize" button.

export type OptimizedVariants = {
  width: number;
  height: number;
  webp: Blob;
  jpeg: Blob;
  thumb: Blob;
  avif?: Blob;
};

async function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch {
      resolve(null);
    }
  });
}

function drawTo(bmp: ImageBitmap, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable in this browser");
  ctx.drawImage(bmp, 0, 0, w, h);
  return canvas;
}

export async function optimizeImageBlob(
  input: Blob,
  opts: { maxW?: number; quality?: number; thumbMaxW?: number; thumbQuality?: number } = {},
): Promise<OptimizedVariants> {
  const maxW = opts.maxW ?? 1600;
  const quality = opts.quality ?? 0.8;
  const thumbMaxW = opts.thumbMaxW ?? 480;
  const thumbQuality = opts.thumbQuality ?? 0.7;

  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(input);
  } catch (e) {
    throw new Error(
      `Cannot decode image (${input.type || "unknown type"}, ${input.size} bytes): ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  const scale = Math.min(1, maxW / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const main = drawTo(bmp, w, h);

  const [webp, jpeg, avif] = await Promise.all([
    encode(main, "image/webp", quality),
    encode(main, "image/jpeg", quality),
    encode(main, "image/avif", quality),
  ]);
  if (!webp) throw new Error("Browser could not encode WebP");
  if (!jpeg) throw new Error("Browser could not encode JPEG");

  const tScale = Math.min(1, thumbMaxW / Math.max(bmp.width, bmp.height));
  const tw = Math.max(1, Math.round(bmp.width * tScale));
  const th = Math.max(1, Math.round(bmp.height * tScale));
  const thumbCanvas = drawTo(bmp, tw, th);
  const thumb = await encode(thumbCanvas, "image/webp", thumbQuality);
  if (!thumb) throw new Error("Browser could not encode thumbnail");

  bmp.close?.();

  return { width: w, height: h, webp, jpeg, thumb, avif: avif ?? undefined };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Replaces the extension on an R2 key with a new one. */
export function withExt(key: string, ext: string): string {
  const dot = key.lastIndexOf(".");
  const base = dot > 0 ? key.slice(0, dot) : key;
  return `${base}.${ext}`;
}

/** Adds a suffix before the extension: foo.webp + ".thumb" → foo.thumb.webp */
export function withSuffix(key: string, suffix: string, ext?: string): string {
  const dot = key.lastIndexOf(".");
  const base = dot > 0 ? key.slice(0, dot) : key;
  const currentExt = dot > 0 ? key.slice(dot + 1) : "";
  return `${base}.${suffix}.${ext ?? currentExt}`;
}
