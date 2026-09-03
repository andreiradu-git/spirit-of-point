import { describe, expect, it } from "vitest";
import { embedForeignKey } from "@/lib/cms-client";

describe("embedForeignKey", () => {
  it("derives gallery_id for embedded gallery images", () => {
    // Regression: a naive `replace(/s$/, "")` produced `gallerie_id`, which made
    // every browser-side gallery read fail and silently fall back to source data.
    expect(embedForeignKey("galleries", "gallery_images")).toBe("gallery_id");
  });

  it("handles regular plurals", () => {
    expect(embedForeignKey("pages", "page_seo")).toBe("page_id");
    expect(embedForeignKey("menu_items", "menu_item_children")).toBe("menu_item_id");
  });
});
