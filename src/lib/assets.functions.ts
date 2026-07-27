import { createServerFn } from "@tanstack/react-start";
import { listAllAssetsDirect, type SiteAsset } from "@/lib/assets.server";

export type { SiteAsset } from "@/lib/assets.server";

export const listAllAssets = createServerFn({ method: "GET" }).handler(async () => listAllAssetsDirect());