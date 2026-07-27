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

    const { openaiChat, parseJsonLoose } = await import("./openai.server");

    const system =
      'You write metadata for a professional photography studio (Point Studio, Bucharest). Return STRICT JSON only with keys: {"label": string, "alt": string, "caption": string, "description": string, "tags": string[]}. label: 2-6 word title. alt: 8-16 word descriptive alt (no "image of" prefix). caption: 1 short sentence for display under the image. description: 2-3 sentences describing subject, mood, lighting, styling. tags: 4-8 lowercase single-word or short-phrase tags. No markdown.';
    const user = `Context: ${data.context ?? "portfolio asset"}. Asset kind: ${data.kind ?? "image"}. URL: ${data.imageUrl}. Write all metadata fields.`;

    const messages: import("./openai.server").ChatMessage[] = [
      { role: "system", content: system },
    ];
    if (data.kind !== "video" && data.kind !== "link") {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: user },
          { type: "image_url", image_url: { url: data.imageUrl } },
        ],
      });
    } else {
      messages.push({ role: "user", content: user });
    }

    const raw = await openaiChat({ messages, jsonMode: true });
    const parsed = parseJsonLoose<{
      label?: string; alt?: string; caption?: string; description?: string; tags?: unknown;
    }>(raw);
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
      : [];
    return {
      label: (parsed.label ?? "").trim(),
      alt: (parsed.alt ?? "").trim(),
      caption: (parsed.caption ?? "").trim(),
      description: (parsed.description ?? "").trim(),
      tags,
    };
  });
