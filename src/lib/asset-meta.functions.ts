import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AssetMeta = {
  url: string;
  label: string | null;
  alt: string | null;
  caption: string | null;
  description: string | null;
  tags: string[];
};

/**
 * Storage helpers (list/save) still use Supabase — that's the current storage
 * layer and will be replaced during the D1 migration phase.
 * The AI generator below delegates to the pure AI service (no Supabase).
 */
export const listAssetMeta = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!key || !url) return [] as AssetMeta[];
  const supabase = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await supabase
    .from("asset_meta")
    .select("url, label, alt, caption, description, tags");
  if (error) throw error;
  return ((data ?? []) as Array<Partial<AssetMeta>>).map((r) => ({
    url: r.url as string,
    label: r.label ?? null,
    alt: r.alt ?? null,
    caption: r.caption ?? null,
    description: r.description ?? null,
    tags: Array.isArray(r.tags) ? r.tags : [],
  }));
});

export const saveAssetMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Forbidden");
    const payload: Record<string, unknown> = { url: data.url };
    if (data.label !== undefined) payload.label = data.label;
    if (data.alt !== undefined) payload.alt = data.alt;
    if (data.caption !== undefined) payload.caption = data.caption;
    if (data.description !== undefined) payload.description = data.description;
    if (data.tags !== undefined) payload.tags = data.tags;
    const { error } = await context.supabase
      .from("asset_meta")
      .upsert(payload as never, { onConflict: "url" });
    if (error) throw error;
    return { ok: true };
  });

export const generateAssetMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        imageUrl: z.string().url(),
        context: z.string().max(400).optional(),
        kind: z.enum(["image", "video", "link"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Forbidden");

    const svc = await import("./ai-service.server");

    if (data.kind === "video") {
      const m = await svc.generateVideoMetadata({
        videoUrl: data.imageUrl,
        context: data.context,
      });
      return m;
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
