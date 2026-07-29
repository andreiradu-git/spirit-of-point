import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import {
  getMediaDbClient,
  inferMediaAssetForUrlDirect,
  listAssetMetaDirect,
} from "@/lib/media-assets.server";

type AssetMetaUpdateQuery = {
  eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
};

type AssetMetaDb = Omit<ReturnType<typeof getMediaDbClient>, "from"> & {
  from: (table: string) => {
    update: (payload: Record<string, unknown>) => AssetMetaUpdateQuery;
  };
};

export type AssetMeta = {
  url: string;
  label: string | null;
  alt: string | null;
  caption: string | null;
  description: string | null;
  tags: string[];
};

export const listAssetMeta = createServerFn({ method: "GET" }).handler(async () =>
  listAssetMetaDirect(),
);

export const saveAssetMeta = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((d) =>
    z
      .object({
        url: z.string().min(1),
        label: z.string().max(400).nullable().optional(),
        alt: z.string().max(600).nullable().optional(),
        caption: z.string().max(1000).nullable().optional(),
        description: z.string().max(4000).nullable().optional(),
        tags: z.array(z.string().max(60)).max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = getMediaDbClient(true) as unknown as AssetMetaDb;
    const media = await inferMediaAssetForUrlDirect(data.url, data.alt ?? undefined);
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.label !== undefined) payload.label = data.label;
    if (data.alt !== undefined) payload.alt = data.alt;
    if (data.caption !== undefined) payload.caption = data.caption;
    if (data.description !== undefined) payload.description = data.description;
    if (data.tags !== undefined) payload.tags = data.tags;
    const { error } = await db.from("media_assets").update(payload).eq("id", media.id);
    if (error) throw error;
    return { ok: true };
  });

export const generateAssetMeta = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        imageUrl: z.string().url(),
        context: z.string().max(400).optional(),
        kind: z.enum(["image", "video", "link"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const svc = await import("./ai-service.server");

    if (data.kind === "video") {
      return svc.generateVideoMetadata({
        videoUrl: data.imageUrl,
        context: data.context,
      });
    }
    if (data.kind === "link") {
      const l = await svc.generateLinkMetadata({
        url: data.imageUrl,
        context: data.context,
      });
      return {
        label: l.title,
        alt: l.description,
        caption: l.description,
        description: l.description,
        tags: [l.category].filter(Boolean),
      };
    }
    return svc.generateImageMetadata({
      imageUrl: data.imageUrl,
      context: data.context,
    });
  });
