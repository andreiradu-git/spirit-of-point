import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { listAllAssetsDirect, type SiteAsset } from "@/lib/assets.server";
import { requireAdminAuth } from "@/lib/admin-auth";
import {
  deleteMediaAssetDirect,
  getMediaDiagnosticsDirect,
  syncR2MediaAssetsDirect,
} from "@/lib/media-assets.server";

export type { SiteAsset } from "@/lib/assets.server";

export const listAllAssets = createServerFn({ method: "GET" }).handler(async () =>
  listAllAssetsDirect(),
);

export const syncMediaAssets = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    await syncR2MediaAssetsDirect();
    return { ok: true };
  });

export const deleteMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        key: z.string().optional(),
        url: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await deleteMediaAssetDirect(data);
    return { ok: true };
  });

export const getMediaDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => getMediaDiagnosticsDirect());
