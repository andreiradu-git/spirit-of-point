import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AwsClient } from "aws4fetch";

function getClient() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  let endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket || !publicUrl) {
    throw new Error("R2 is not configured (missing env vars)");
  }
  // Strip trailing slash + accidental bucket suffix in endpoint (e.g. "https://<acct>.r2.cloudflarestorage.com/<bucket>")
  endpoint = endpoint.replace(/\/+$/, "");
  const suffix = `/${bucket}`;
  if (endpoint.endsWith(suffix)) endpoint = endpoint.slice(0, -suffix.length);
  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });
  return { client, endpoint, bucket, publicUrl: publicUrl.replace(/\/+$/, "") };
}

async function assertAdmin(context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sanitize(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const uploadToR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { filename: string; contentType: string; dataBase64: string; folder?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { client, endpoint, bucket, publicUrl } = getClient();

    const ext = (data.filename.split(".").pop() || "bin").toLowerCase();
    const base = sanitize(data.filename.replace(/\.[^.]+$/, "")) || "file";
    const folder = (data.folder || "uploads").replace(/^\/+|\/+$/g, "") || "uploads";
    const key = `${folder}/${base}-${Date.now()}.${ext}`;

    const body = b64ToBytes(data.dataBase64);
    const url = `${endpoint}/${bucket}/${encodeURI(key)}`;
    const res = await client.fetch(url, {
      method: "PUT",
      body: body as BodyInit,
      headers: {
        "content-type": data.contentType || "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`R2 upload failed [${res.status}]: ${text}`);
    }
    return { url: `${publicUrl}/${key}`, key, size: body.byteLength };
  });

export type R2Object = {
  key: string;
  url: string;
  size: number;
  contentType?: string;
  lastModified?: string;
};

export const listR2Objects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { client, endpoint, bucket, publicUrl } = getClient();
    const results: R2Object[] = [];
    let continuationToken: string | undefined;
    do {
      const params = new URLSearchParams({ "list-type": "2", "max-keys": "1000" });
      if (continuationToken) params.set("continuation-token", continuationToken);
      const url = `${endpoint}/${bucket}/?${params.toString()}`;
      const res = await client.fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`R2 list failed [${res.status}]: ${await res.text()}`);
      const xml = await res.text();
      const contents = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? [];
      for (const c of contents) {
        const key = c.match(/<Key>([^<]+)<\/Key>/)?.[1];
        const size = Number(c.match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0);
        const lastModified = c.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1];
        if (!key) continue;
        results.push({
          key,
          url: `${publicUrl}/${key}`,
          size,
          lastModified,
        });
      }
      const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
      continuationToken = truncated
        ? xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1]
        : undefined;
    } while (continuationToken);
    return results;
  });

export const deleteR2Object = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { client, endpoint, bucket } = getClient();
    const url = `${endpoint}/${bucket}/${encodeURI(data.key)}`;
    const res = await client.fetch(url, { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      throw new Error(`R2 delete failed [${res.status}]: ${await res.text()}`);
    }
    return { ok: true };
  });

/**
 * Migrate all files from the Supabase Storage `media` bucket to Cloudflare R2.
 * - Skips files already present in R2 (same key).
 * - Rewrites URLs everywhere: gallery_images.src, gallery_images.thumb_src,
 *   site_settings (string values or nested { url } / items[].{src,url}),
 *   asset_meta.url.
 * - Does NOT delete originals from Supabase Storage.
 */
export const migrateSupabaseToR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { client, endpoint, bucket, publicUrl } = getClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) List existing R2 keys so we can skip
    const existing = new Set<string>();
    {
      let token: string | undefined;
      do {
        const params = new URLSearchParams({ "list-type": "2", "max-keys": "1000" });
        if (token) params.set("continuation-token", token);
        const res = await client.fetch(`${endpoint}/${bucket}/?${params}`, { method: "GET" });
        if (!res.ok) break;
        const xml = await res.text();
        for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) existing.add(m[1]);
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
          ? xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1]
          : undefined;
      } while (token);
    }

    // 2) Walk Supabase Storage `media` bucket recursively
    const files: { path: string; contentType?: string }[] = [];
    async function walk(prefix: string) {
      const { data, error } = await supabaseAdmin.storage.from("media").list(prefix, { limit: 1000 });
      if (error) return;
      for (const item of data ?? []) {
        const full = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null || item.metadata === null) {
          await walk(full);
        } else {
          files.push({
            path: full,
            contentType: (item.metadata as { mimetype?: string })?.mimetype,
          });
        }
      }
    }
    await walk("");

    // 3) Copy each file to R2
    const urlMap = new Map<string, string>(); // old supabase URL -> new R2 URL
    let copied = 0;
    let skipped = 0;
    let failed = 0;
    for (const f of files) {
      const key = f.path; // preserve folder structure
      const oldUrl = supabaseAdmin.storage.from("media").getPublicUrl(f.path).data.publicUrl;
      const newUrl = `${publicUrl}/${key}`;
      urlMap.set(oldUrl, newUrl);
      if (existing.has(key)) {
        skipped++;
        continue;
      }
      try {
        const dl = await supabaseAdmin.storage.from("media").download(f.path);
        if (dl.error || !dl.data) throw dl.error ?? new Error("download failed");
        const buf = new Uint8Array(await dl.data.arrayBuffer());
        const res = await client.fetch(`${endpoint}/${bucket}/${encodeURI(key)}`, {
          method: "PUT",
          body: buf as BodyInit,
          headers: {
            "content-type": f.contentType || dl.data.type || "application/octet-stream",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        copied++;
      } catch (e) {
        console.error("R2 copy failed for", f.path, e);
        failed++;
      }
    }

    // 4) Rewrite URLs in DB
    let rewrites = 0;
    const rewrite = (s: string): string => {
      for (const [oldU, newU] of urlMap) if (s.includes(oldU)) return s.split(oldU).join(newU);
      return s;
    };
    const hasAny = (s: string) => {
      for (const oldU of urlMap.keys()) if (s.includes(oldU)) return true;
      return false;
    };

    // gallery_images
    const { data: imgs } = await supabaseAdmin
      .from("gallery_images")
      .select("id, src, thumb_src");
    for (const row of imgs ?? []) {
      const patch: Record<string, string> = {};
      if (row.src && hasAny(row.src)) patch.src = rewrite(row.src);
      if (row.thumb_src && hasAny(row.thumb_src)) patch.thumb_src = rewrite(row.thumb_src);
      if (Object.keys(patch).length) {
        await supabaseAdmin.from("gallery_images").update(patch).eq("id", row.id);
        rewrites++;
      }
    }

    // asset_meta
    const { data: metas } = await supabaseAdmin.from("asset_meta").select("url");
    for (const row of metas ?? []) {
      if (row.url && hasAny(row.url)) {
        const newUrl = rewrite(row.url);
        await supabaseAdmin.from("asset_meta").update({ url: newUrl }).eq("url", row.url);
        rewrites++;
      }
    }

    // site_settings
    const { data: settings } = await supabaseAdmin.from("site_settings").select("key, value");
    const walkVal = (v: unknown): unknown => {
      if (typeof v === "string") return hasAny(v) ? rewrite(v) : v;
      if (Array.isArray(v)) return v.map(walkVal);
      if (v && typeof v === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walkVal(val);
        return out;
      }
      return v;
    };
    for (const row of settings ?? []) {
      const next = walkVal(row.value);
      if (JSON.stringify(next) !== JSON.stringify(row.value)) {
        await supabaseAdmin.from("site_settings").update({ value: next }).eq("key", row.key);
        rewrites++;
      }
    }

    return { totalFiles: files.length, copied, skipped, failed, rewrites };
  });
