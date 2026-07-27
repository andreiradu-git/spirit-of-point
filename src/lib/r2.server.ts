import { AwsClient } from "aws4fetch";
import { getRequest } from "@tanstack/react-start/server";

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

type RuntimeSource = "env" | "request.runtime.cloudflare.env" | "globalThis.__POINTSTUDIO_WORKER_ENV__" | "globalThis.__env__" | "process.env";

type RuntimeValue = {
  value?: string;
  source?: RuntimeSource;
  name?: string;
};

export type R2RuntimeDebug = {
  workerBindingSeen: boolean;
  available: Record<"R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_ACCOUNT_ID" | "R2_ENDPOINT" | "R2_BUCKET_NAME", boolean>;
  sources: Record<"R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_ACCOUNT_ID" | "R2_ENDPOINT" | "R2_BUCKET_NAME", RuntimeSource | null>;
  resolvedNames: Record<"R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_ACCOUNT_ID" | "R2_ENDPOINT" | "R2_BUCKET_NAME", string | null>;
  endpointResolvedFromAccountId: boolean;
  r2ClientFile: string;
};

declare global {
  var __POINTSTUDIO_WORKER_ENV__: Record<string, unknown> | undefined;
  var __env__: Record<string, unknown> | undefined;
}

type CloudflareRuntimeRequest = Request & {
  runtime?: {
    cloudflare?: {
      env?: Record<string, unknown>;
    };
  };
};

function normalizeEnvValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function readRequestEnv(name: string): string | undefined {
  try {
    const request = getRequest() as CloudflareRuntimeRequest;
    return normalizeEnvValue(request.runtime?.cloudflare?.env?.[name]);
  } catch {
    return undefined;
  }
}

function readRequestRuntimeValue(name: string): RuntimeValue {
  try {
    const request = getRequest() as CloudflareRuntimeRequest;
    const value = normalizeEnvValue(request.runtime?.cloudflare?.env?.[name]);
    return value ? { value, source: "request.runtime.cloudflare.env", name } : {};
  } catch {
    return {};
  }
}

function readRuntimeEnv(name: string): RuntimeValue {
  const requestValue = readRequestRuntimeValue(name);
  if (requestValue.value) return requestValue;

  const workerValue = normalizeEnvValue(globalThis.__POINTSTUDIO_WORKER_ENV__?.[name]);
  if (workerValue) return { value: workerValue, source: "globalThis.__POINTSTUDIO_WORKER_ENV__", name };

  const nitroValue = normalizeEnvValue(globalThis.__env__?.[name]);
  if (nitroValue) return { value: nitroValue, source: "globalThis.__env__", name };

  const processEnv = typeof process !== "undefined" ? process.env?.[name] : undefined;
  const processValue = normalizeEnvValue(processEnv);
  if (processValue) return { value: processValue, source: "process.env", name };

  return {};
}

function readFirstRuntimeEnv(names: string[]): RuntimeValue {
  for (const name of names) {
    const result = readRuntimeEnv(name);
    if (result.value) return result;
  }
  return {};
}

function runtimeValue(names: string[]): RuntimeValue {
  return readFirstRuntimeEnv(names);
}

function workerBindingSeen(): boolean {
  try {
    const request = getRequest() as CloudflareRuntimeRequest;
    if (request.runtime?.cloudflare?.env && Object.keys(request.runtime.cloudflare.env).length > 0) return true;
  } catch {
    // Ignore: getRequest is only available during server requests.
  }
  return Boolean(
    (globalThis.__POINTSTUDIO_WORKER_ENV__ && Object.keys(globalThis.__POINTSTUDIO_WORKER_ENV__).length > 0) ||
      (globalThis.__env__ && Object.keys(globalThis.__env__).length > 0),
  );
}

export function getR2Client(): R2ClientBundle {
  const accessKeyId = runtimeValue(["R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"]);
  const secretAccessKey = runtimeValue(["R2_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY"]);
  const accountId = runtimeValue(["R2_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID"]);
  let endpoint = runtimeValue(["R2_ENDPOINT", "CLOUDFLARE_R2_ENDPOINT"]);
  const bucket = runtimeValue(["R2_BUCKET_NAME", "R2_BUCKET", "CLOUDFLARE_R2_BUCKET"]);
  const publicUrl = runtimeValue(["R2_PUBLIC_URL", "CLOUDFLARE_R2_PUBLIC_URL"]);

  if (!endpoint.value && accountId.value) {
    endpoint = {
      value: `https://${accountId.value}.r2.cloudflarestorage.com`,
      source: accountId.source,
      name: accountId.name,
    };
  }

  const resolvedPublicUrl = publicUrl.value || "https://images.pointstudio.ro";

  if (!accessKeyId.value || !secretAccessKey.value || !endpoint.value || !bucket.value || !resolvedPublicUrl) {
    const missing = [
      ...(!accessKeyId.value ? ["R2_ACCESS_KEY_ID"] : []),
      ...(!secretAccessKey.value ? ["R2_SECRET_ACCESS_KEY"] : []),
      ...(!endpoint.value ? ["R2_ENDPOINT or R2_ACCOUNT_ID"] : []),
      ...(!bucket.value ? ["R2_BUCKET_NAME or R2_BUCKET"] : []),
    ];
    const sourceSummary = getR2RuntimeDebug().sources;
    console.info("R2 runtime configuration check", sourceSummary);
    throw new Error(`Cloudflare R2 is not configured: ${missing.join(", ")}`);
  }

  let cleanEndpoint = endpoint.value.replace(/\/+$/, "");
  const suffix = `/${bucket.value}`;
  if (cleanEndpoint.endsWith(suffix)) cleanEndpoint = cleanEndpoint.slice(0, -suffix.length);

  const client = new AwsClient({
    accessKeyId: accessKeyId.value,
    secretAccessKey: secretAccessKey.value,
    service: "s3",
    region: "auto",
  });

  return { client, endpoint: cleanEndpoint, bucket: bucket.value, publicUrl: resolvedPublicUrl.replace(/\/+$/, "") };
}

export function getR2RuntimeDebug(): R2RuntimeDebug {
  const accessKeyId = runtimeValue(["R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"]);
  const secretAccessKey = runtimeValue(["R2_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY"]);
  const accountId = runtimeValue(["R2_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID"]);
  const directEndpoint = runtimeValue(["R2_ENDPOINT", "CLOUDFLARE_R2_ENDPOINT"]);
  const bucket = runtimeValue(["R2_BUCKET_NAME", "R2_BUCKET", "CLOUDFLARE_R2_BUCKET"]);

  const endpointResolvedFromAccountId = !directEndpoint.value && Boolean(accountId.value);
  const endpointSource = directEndpoint.source ?? (endpointResolvedFromAccountId ? accountId.source : undefined);
  const endpointName = directEndpoint.name ?? (endpointResolvedFromAccountId ? accountId.name : undefined);

  return {
    workerBindingSeen: workerBindingSeen(),
    available: {
      R2_ACCESS_KEY_ID: Boolean(accessKeyId.value),
      R2_SECRET_ACCESS_KEY: Boolean(secretAccessKey.value),
      R2_ACCOUNT_ID: Boolean(accountId.value),
      R2_ENDPOINT: Boolean(directEndpoint.value || endpointResolvedFromAccountId),
      R2_BUCKET_NAME: Boolean(bucket.value),
    },
    sources: {
      R2_ACCESS_KEY_ID: accessKeyId.source ?? null,
      R2_SECRET_ACCESS_KEY: secretAccessKey.source ?? null,
      R2_ACCOUNT_ID: accountId.source ?? null,
      R2_ENDPOINT: endpointSource ?? null,
      R2_BUCKET_NAME: bucket.source ?? null,
    },
    resolvedNames: {
      R2_ACCESS_KEY_ID: accessKeyId.name ?? null,
      R2_SECRET_ACCESS_KEY: secretAccessKey.name ?? null,
      R2_ACCOUNT_ID: accountId.name ?? null,
      R2_ENDPOINT: endpointName ?? null,
      R2_BUCKET_NAME: bucket.name ?? null,
    },
    endpointResolvedFromAccountId,
    r2ClientFile: "src/lib/r2.server.ts",
  };
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

export async function copyR2ObjectDirect(fromKey: string, toKey: string): Promise<string> {
  const { client, endpoint, bucket, publicUrl } = getR2Client();
  const res = await client.fetch(`${endpoint}/${bucket}/${encodeURI(toKey)}`, {
    method: "PUT",
    headers: {
      "x-amz-copy-source": `/${bucket}/${encodeURI(fromKey)}`,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
  if (!res.ok) throw new Error(`R2 copy failed [${res.status}]: ${await res.text()}`);
  return `${publicUrl}/${toKey}`;
}
