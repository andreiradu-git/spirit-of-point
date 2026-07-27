import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AwsClient } from "aws4fetch";

function getClient() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket || !publicUrl) {
    throw new Error("R2 is not configured (missing env vars)");
  }
  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });
  return { client, endpoint: endpoint.replace(/\/+$/, ""), bucket, publicUrl: publicUrl.replace(/\/+$/, "") };
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
      body,
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
