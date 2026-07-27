import { getRequest } from "@tanstack/react-start/server";
import { getStartContext } from "@tanstack/start-storage-context";

export type R2Object = {
  key: string;
  url: string;
  size: number;
  contentType?: string;
  lastModified?: string;
};

const BINDING_NAME = "MY_ASSETS";
const PUBLIC_URL = "https://images.pointstudio.ro";

// Minimal shape of the Cloudflare R2Bucket binding we rely on.
type R2BucketBinding = {
  put: (
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string | null,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
    },
  ) => Promise<unknown>;
  get: (key: string) => Promise<{
    body: ReadableStream;
    arrayBuffer: () => Promise<ArrayBuffer>;
    httpMetadata?: { contentType?: string };
    size: number;
  } | null>;
  delete: (key: string) => Promise<void>;
  list: (options?: {
    limit?: number;
    cursor?: string;
    prefix?: string;
  }) => Promise<{
    objects: Array<{
      key: string;
      size: number;
      uploaded: Date;
      httpMetadata?: { contentType?: string };
    }>;
    truncated: boolean;
    cursor?: string;
  }>;
};

export type R2RuntimeDiagnostics = {
  runtime: "cloudflare-worker" | "none";
  hasBucketBinding: boolean;
  bindingName: string;
};

declare global {
  var __POINTSTUDIO_WORKER_ENV__: Record<string, unknown> | undefined;
  var __POINTSTUDIO_WORKER_RUNTIME__: string | undefined;
  var __env__: Record<string, unknown> | undefined;
}

type CloudflareRuntimeRequest = Request & {
  runtime?: {
    name?: string;
    cloudflare?: { env?: Record<string, unknown>; context?: unknown };
  };
};

type StartContextWithCloudflareEnv = {
  contextAfterGlobalMiddlewares?: { cloudflareEnv?: Record<string, unknown> };
  request?: CloudflareRuntimeRequest;
};

function isR2Bucket(value: unknown): value is R2BucketBinding {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { put?: unknown }).put === "function" &&
    typeof (value as { get?: unknown }).get === "function" &&
    typeof (value as { list?: unknown }).list === "function" &&
    typeof (value as { delete?: unknown }).delete === "function"
  );
}

async function resolveBucketBinding(): Promise<R2BucketBinding | undefined> {
  // 1) Modern Cloudflare Workers env import
  try {
    const moduleName = "cloudflare:workers";
    const mod = (await import(/* @vite-ignore */ moduleName)) as {
      env?: Record<string, unknown>;
    };
    const candidate = mod.env?.[BINDING_NAME];
    if (isR2Bucket(candidate)) return candidate;
  } catch {
    // not in a Cloudflare runtime that supports the module import
  }

  // 2) TanStack Start request context (populated by src/server.ts)
  try {
    const ctx = getStartContext({ throwIfNotFound: false }) as
      | StartContextWithCloudflareEnv
      | undefined;
    const fromCtx = ctx?.contextAfterGlobalMiddlewares?.cloudflareEnv?.[BINDING_NAME];
    if (isR2Bucket(fromCtx)) return fromCtx;
    const fromReq = ctx?.request?.runtime?.cloudflare?.env?.[BINDING_NAME];
    if (isR2Bucket(fromReq)) return fromReq;
  } catch {}

  // 3) Request runtime binding
  try {
    const req = getRequest() as CloudflareRuntimeRequest;
    const fromReq = req.runtime?.cloudflare?.env?.[BINDING_NAME];
    if (isR2Bucket(fromReq)) return fromReq;
  } catch {}

  // 4) Global fallbacks
  const fromGlobal = globalThis.__POINTSTUDIO_WORKER_ENV__?.[BINDING_NAME];
  if (isR2Bucket(fromGlobal)) return fromGlobal;
  const fromNitro = globalThis.__env__?.[BINDING_NAME];
  if (isR2Bucket(fromNitro)) return fromNitro;

  return undefined;
}

async function getBucket(): Promise<R2BucketBinding> {
  const bucket = await resolveBucketBinding();
  if (!bucket) {
    throw new Error(
      `Cloudflare R2 binding "${BINDING_NAME}" not found in the Worker runtime`,
    );
  }
  return bucket;
}

export async function getR2Client(): Promise<{ publicUrl: string }> {
  return { publicUrl: PUBLIC_URL };
}

export async function getR2RuntimeDiagnostics(): Promise<R2RuntimeDiagnostics> {
  const bucket = await resolveBucketBinding();
  return {
    runtime: bucket ? "cloudflare-worker" : "none",
    hasBucketBinding: Boolean(bucket),
    bindingName: BINDING_NAME,
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

export async function listR2ObjectsDirect(): Promise<R2Object[]> {
  const bucket = await getBucket();
  const results: R2Object[] = [];
  let cursor: string | undefined;

  do {
    const page = await bucket.list({ limit: 1000, cursor });
    for (const obj of page.objects) {
      results.push({
        key: obj.key,
        url: `${PUBLIC_URL}/${obj.key}`,
        size: obj.size,
        contentType: obj.httpMetadata?.contentType,
        lastModified:
          obj.uploaded instanceof Date ? obj.uploaded.toISOString() : undefined,
      });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return results;
}

export async function putR2Object(
  key: string,
  body: Uint8Array,
  contentType?: string,
): Promise<string> {
  const bucket = await getBucket();
  await bucket.put(key, body, {
    httpMetadata: {
      contentType: contentType || "application/octet-stream",
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return `${PUBLIC_URL}/${key}`;
}

export async function deleteR2ObjectDirect(key: string): Promise<void> {
  const bucket = await getBucket();
  await bucket.delete(key);
}

export async function copyR2ObjectDirect(
  fromKey: string,
  toKey: string,
): Promise<string> {
  const bucket = await getBucket();
  const source = await bucket.get(fromKey);
  if (!source) throw new Error(`R2 copy failed: source "${fromKey}" not found`);
  const body = new Uint8Array(await source.arrayBuffer());
  await bucket.put(toKey, body, {
    httpMetadata: {
      contentType: source.httpMetadata?.contentType || "application/octet-stream",
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return `${PUBLIC_URL}/${toKey}`;
}
