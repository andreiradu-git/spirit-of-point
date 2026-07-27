import { AwsClient } from "aws4fetch";

export type R2Object = {
  key: string;
  url: string;
  size: number;
  contentType?: string;
  lastModified?: string;
};

type R2ClientBundle = {
  client: AwsClient;
  endpoint: string;
  bucket: string;
  publicUrl: string;
};

export function getR2Client(): R2ClientBundle {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const accountId = process.env.R2_ACCOUNT_ID;
  let endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL || "https://images.pointstudio.ro";

  if (!endpoint && accountId) endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket || !publicUrl) {
    const missing = [
      ...(!accessKeyId ? ["R2_ACCESS_KEY_ID"] : []),
      ...(!secretAccessKey ? ["R2_SECRET_ACCESS_KEY"] : []),
      ...(!endpoint ? ["R2_ENDPOINT or R2_ACCOUNT_ID"] : []),
      ...(!bucket ? ["R2_BUCKET_NAME or R2_BUCKET"] : []),
      ...(!publicUrl ? ["R2_PUBLIC_URL"] : []),
    ];
    throw new Error(`Cloudflare R2 is not configured: ${missing.join(", ")}`);
  }

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

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function listR2ObjectsDirect(): Promise<R2Object[]> {
  const { client, endpoint, bucket, publicUrl } = getR2Client();
  const results: R2Object[] = [];
  let continuationToken: string | undefined;

  do {
    const params = new URLSearchParams({ "list-type": "2", "max-keys": "1000" });
    if (continuationToken) params.set("continuation-token", continuationToken);
    const res = await client.fetch(`${endpoint}/${bucket}/?${params.toString()}`, { method: "GET" });
    if (!res.ok) throw new Error(`R2 list failed [${res.status}]: ${await res.text()}`);
    const xml = await res.text();
    const contents = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? [];

    for (const c of contents) {
      const key = c.match(/<Key>([^<]+)<\/Key>/)?.[1];
      const size = Number(c.match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0);
      const lastModified = c.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1];
      if (!key) continue;
      const cleanKey = decodeXml(key);
      results.push({
        key: cleanKey,
        url: `${publicUrl}/${cleanKey}`,
        size,
        lastModified,
      });
    }

    continuationToken = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1]
      : undefined;
  } while (continuationToken);

  return results;
}

export async function putR2Object(key: string, body: Uint8Array, contentType?: string): Promise<string> {
  const { client, endpoint, bucket, publicUrl } = getR2Client();
  const res = await client.fetch(`${endpoint}/${bucket}/${encodeURI(key)}`, {
    method: "PUT",
    body: body as BodyInit,
    headers: {
      "content-type": contentType || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
  if (!res.ok) throw new Error(`R2 upload failed [${res.status}]: ${await res.text()}`);
  return `${publicUrl}/${key}`;
}

export async function deleteR2ObjectDirect(key: string): Promise<void> {
  const { client, endpoint, bucket } = getR2Client();
  const res = await client.fetch(`${endpoint}/${bucket}/${encodeURI(key)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed [${res.status}]: ${await res.text()}`);
  }
}