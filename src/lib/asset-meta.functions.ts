import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AssetMeta = { url: string; label: string | null; alt: string | null };

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
  const { data, error } = await supabase.from("asset_meta").select("url, label, alt");
  if (error) throw error;
  return (data ?? []) as AssetMeta[];
});

export const saveAssetMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        url: z.string().min(1),
        label: z.string().max(400).nullable().optional(),
        alt: z.string().max(600).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("asset_meta")
      .upsert({ url: data.url, label: data.label ?? null, alt: data.alt ?? null }, { onConflict: "url" });
    if (error) throw error;
    return { ok: true };
  });

export const generateAssetMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
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

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const system =
      "You write metadata for a professional photography studio (Point Studio, Bucharest). Return STRICT JSON only: {\"label\": string, \"alt\": string}. label: 2-6 word title. alt: 8-16 word descriptive alt text, no 'image of' prefix, describe subject/mood/lighting. No markdown.";
    const user = `Context: ${data.context ?? "portfolio asset"}. Asset kind: ${data.kind ?? "image"}. URL: ${data.imageUrl}. Write label + alt.`;

    const messages: Array<{ role: string; content: unknown }> = [{ role: "system", content: system }];
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

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("Rate limit — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Plans & credits.");
      throw new Error(`AI error (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(raw) as { label?: string; alt?: string };
      return { label: (parsed.label ?? "").trim(), alt: (parsed.alt ?? "").trim() };
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      const parsed = m ? (JSON.parse(m[0]) as { label?: string; alt?: string }) : {};
      return { label: (parsed.label ?? "").trim(), alt: (parsed.alt ?? "").trim() };
    }
  });
