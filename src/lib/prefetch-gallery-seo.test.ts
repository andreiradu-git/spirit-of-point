import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const getPublic = vi.fn();
vi.mock("@/lib/gallery-seo-public.functions", () => ({ getPublicGallerySeo: (a: unknown) => getPublic(a) }));
vi.mock("@/hooks/use-site-texts", () => ({ fetchTexts: async () => ({}) }));
vi.mock("@/hooks/use-gallery-seo", async (orig) => {
  const real = await orig<typeof import("@/hooks/use-gallery-seo")>();
  return { ...real, fetchAllGallerySeo: async () => ({}) };
});

import { prefetchGallerySeo } from "./prefetch-gallery-seo";

describe("prefetchGallerySeo required record", () => {
  beforeEach(() => {
    getPublic.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("does not throw when every retry fails; record is simply omitted", async () => {
    getPublic.mockRejectedValue(new Error("D1 down"));
    const qc = new QueryClient();
    await expect(prefetchGallerySeo(qc, "corporate#ro")).resolves.toBeUndefined();
    expect(getPublic).toHaveBeenCalledTimes(3);
    expect((qc.getQueryData(["gallery-seo", "all"]) as Record<string, unknown>)["corporate#ro"]).toBeUndefined();
  });

  it("recovers after a temporary failure", async () => {
    getPublic.mockRejectedValueOnce(new Error("blip")).mockResolvedValue({ html: "<p>x</p>", faqs: [{ q: "Q", a: "A" }] });
    const qc = new QueryClient();
    await prefetchGallerySeo(qc, "wanders#ro");
    const rec = (qc.getQueryData(["gallery-seo", "all"]) as Record<string, any>)["wanders#ro"];
    expect(rec.html).toBe("<p>x</p>");
    expect(rec.faqs).toEqual([{ q: "Q", a: "A" }]);
  });

  it("normalises a malformed record (missing arrays, bad FAQ items)", async () => {
    getPublic.mockResolvedValue({ html: 5, faqs: "nope", tags: null, extra: 1 });
    const qc = new QueryClient();
    await prefetchGallerySeo(qc, "wanders");
    const rec = (qc.getQueryData(["gallery-seo", "all"]) as Record<string, any>)["wanders"];
    expect(rec.html).toBe("");
    expect(rec.faqs).toEqual([]);
    expect(rec.tags).toEqual([]);
  });
});
