import { describe, it, expect, vi, afterEach } from "vitest";
import {
  assertWebpBlob,
  isWorthStoring,
  optimizeImageBlob,
  OPTIMIZED_MIME,
  NOT_SMALLER_MESSAGE,
} from "./optimize-image";
import { looksLikeWebp, assertWebpBytes } from "./r2.functions";

/** Installs fake browser globals so the canvas pipeline can run under Node. */
function installCanvas(opts: {
  encodeType: string;
  size: number;
  srcWidth?: number;
  srcHeight?: number;
}) {
  const w = opts.srcWidth ?? 4000;
  const h = opts.srcHeight ?? 3000;
  vi.stubGlobal("createImageBitmap", async () => ({ width: w, height: h, close() {} }));
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage() {} }),
      toBlob: (cb: (b: Blob) => void, type: string) => {
        // A browser without a WebP encoder ignores `type` and returns PNG.
        const actual = opts.encodeType || type;
        cb(new Blob([new Uint8Array(opts.size)], { type: actual }));
      },
    }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("assertWebpBlob", () => {
  it("accepts a real WebP blob", () => {
    expect(() => assertWebpBlob(new Blob([], { type: OPTIMIZED_MIME }))).not.toThrow();
  });

  it("rejects a PNG blob (Safari fallback)", () => {
    expect(() => assertWebpBlob(new Blob([], { type: "image/png" }))).toThrow(/cannot encode WebP/i);
  });

  it("rejects a JPEG blob", () => {
    expect(() => assertWebpBlob(new Blob([], { type: "image/jpeg" }))).toThrow(/image\/jpeg/);
  });
});

describe("isWorthStoring", () => {
  it("keeps a smaller derivative", () => {
    expect(isWorthStoring(300_000, 1_000_000)).toBe(true);
  });
  it("rejects a larger derivative (the PSP_7 case: 2.1MB -> 6.5MB)", () => {
    expect(isWorthStoring(6_673_728, 2_177_928)).toBe(false);
  });
  it("rejects an equal-size derivative", () => {
    expect(isWorthStoring(500, 500)).toBe(false);
  });
  it("has a clear informational message", () => {
    expect(NOT_SMALLER_MESSAGE).toMatch(/original retained/i);
  });
});

describe("optimizeImageBlob", () => {
  it("returns a validated WebP with the resize cap applied and no upscaling", async () => {
    installCanvas({ encodeType: OPTIMIZED_MIME, size: 400_000, srcWidth: 4000, srcHeight: 3000 });
    const out = await optimizeImageBlob(new Blob([new Uint8Array(10)], { type: "image/jpeg" }));
    expect(out.mimeType).toBe(OPTIMIZED_MIME);
    expect(out.webp.type).toBe(OPTIMIZED_MIME);
    expect(Math.max(out.width, out.height)).toBe(2400); // 2400px long edge preserved
    expect(out.width).toBe(2400);
    expect(out.height).toBe(1800);
  });

  it("never upscales a small source", async () => {
    installCanvas({ encodeType: OPTIMIZED_MIME, size: 1000, srcWidth: 800, srcHeight: 600 });
    const out = await optimizeImageBlob(new Blob([new Uint8Array(10)], { type: "image/jpeg" }));
    expect(out.width).toBe(800);
    expect(out.height).toBe(600);
  });

  it("aborts when the browser returns PNG instead of WebP", async () => {
    installCanvas({ encodeType: "image/png", size: 6_673_728 });
    await expect(
      optimizeImageBlob(new Blob([new Uint8Array(10)], { type: "image/jpeg" })),
    ).rejects.toThrow(/cannot encode WebP/i);
  });
});

describe("server-side .webp payload guard", () => {
  const webpBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  ]);
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);

  it("detects real WebP bytes", () => {
    expect(looksLikeWebp(webpBytes)).toBe(true);
    expect(looksLikeWebp(pngBytes)).toBe(false);
  });

  it("allows a valid optimized WebP write", () => {
    expect(() => assertWebpBytes("optimized/x.webp", "image/webp", webpBytes)).not.toThrow();
  });

  it("rejects PNG bytes stored under a .webp key", () => {
    expect(() => assertWebpBytes("optimized/x.webp", "image/webp", pngBytes)).toThrow(/not WebP/i);
  });

  it("rejects a mismatched content type on a .webp key", () => {
    expect(() => assertWebpBytes("optimized/x.webp", "image/png", webpBytes)).toThrow(/content type/i);
  });

  it("ignores non-webp keys", () => {
    expect(() => assertWebpBytes("originals/x.jpg", "image/jpeg", pngBytes)).not.toThrow();
  });
});
