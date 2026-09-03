import { describe, expect, it } from "vitest";
import {
  deliveryDimensions,
  exceedsCloudflareImageLimit,
  IMAGE_UPLOAD_LIMITS,
  isValidWebMasterBlob,
} from "./image-upload";

describe("image upload protection helpers", () => {
  it("detects Cloudflare input limits", () => {
    expect(exceedsCloudflareImageLimit({ width: 10_000, height: 10_000 })).toBe(false);
    expect(exceedsCloudflareImageLimit({ width: 10_001, height: 10_000 })).toBe(true);
    expect(exceedsCloudflareImageLimit({ width: 50_001, height: 1 })).toBe(true);
  });

  it("creates a 3000px delivery dimension without upscaling", () => {
    expect(deliveryDimensions({ width: 14_607, height: 10_926 })).toEqual({ width: 3000, height: 2244 });
    expect(deliveryDimensions({ width: 1200, height: 800 })).toEqual({ width: 1200, height: 800 });
    expect(IMAGE_UPLOAD_LIMITS.webMasterLongEdge).toBe(3000);
  });

  it("accepts only non-empty JPEG web masters", () => {
    expect(isValidWebMasterBlob(new Blob(["x"], { type: "image/jpeg" }))).toBe(true);
    expect(isValidWebMasterBlob(new Blob(["x"], { type: "image/png" }))).toBe(false);
  });
});
