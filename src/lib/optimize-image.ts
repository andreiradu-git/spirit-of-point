// Shared browser-side image optimization pipeline.
// Produces a single optimized WebP display file. The original stays untouched
// as backup (handled by the caller). No JPEG / AVIF / thumbnail variants.
//
// Rules:
//  - Never resize the longest edge below 2400px (MIN_LONG_EDGE).
//  - Never upscale.
//  - Downscale to MIN_LONG_EDGE only when the original is larger.
//  - Iterate WebP quality to fit under TARGET_BYTES (1 MB) when possible.
//  - Aspect ratio is always preserved.
//  - Canvas re-encoding strips EXIF and other metadata automatically.

export type OptimizedImage = {
  width: number;
  height: number;
  webp: Blob;
  originalSize: number;
  quality: number;
};

const MIN_LONG_EDGE = 2400;
const TARGET_BYTES = 1024 * 1024; // 1 MB

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

export async function optimizeImageBlob(input: Blob): Promise<OptimizedImage> {
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

  const longest = Math.max(bmp.width, bmp.height);
  const scale = longest > MIN_LONG_EDGE ? MIN_LONG_EDGE / longest : 1;
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = drawTo(bmp, w, h);

  const qualities = [0.85, 0.78, 0.7, 0.62, 0.55, 0.48, 0.4];
  let webp: Blob | null = null;
  let usedQuality = qualities[0];
  for (const q of qualities) {
    const attempt = await encode(canvas, "image/webp", q);
    if (!attempt) continue;
    webp = attempt;
    usedQuality = q;
    if (attempt.size <= TARGET_BYTES) break;
  }
  bmp.close?.();
  if (!webp) throw new Error("Browser could not encode WebP");

  return { width: w, height: h, webp, originalSize: input.size, quality: usedQuality };
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
