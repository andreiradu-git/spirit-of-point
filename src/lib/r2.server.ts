import { getRequest } from "@tanstack/react-start/server";
import { getStartContext } from "@tanstack/start-storage-context";
import { readServerEnv } from "@/lib/server-env";

export type R2Object = {
  key: string;
  url: string;
  size: number;
  contentType?: string;
  lastModified?: string;
  originalName?: string;
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
      customMetadata?: Record<string, string>;
    },
  ) => Promise<unknown>;
  get: (key: string) => Promise<{
    body: ReadableStream;
    arrayBuffer: () => Promise<ArrayBuffer>;
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
    size: number;
  } | null>;
  delete: (key: string) => Promise<void>;
  list: (options?: {
    limit?: number;
    cursor?: string;
    prefix?: string;
    include?: Array<"httpMetadata" | "customMetadata">;
  }) => Promise<{
    objects: Array<{
      key: string;
      size: number;
      uploaded: Date;
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
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

function shouldLogRuntimeDiagnostics() {
  return (
    readServerEnv("TEMP_MEDIA_DIAGNOSTICS") === "true" ||
    readServerEnv("MEDIA_DIAGNOSTICS_ENABLED") === "true"
  );
}

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
  if (shouldLogRuntimeDiagnostics()) {
    try {
      const ctx = getStartContext({ throwIfNotFound: false }) as
        StartContextWithCloudflareEnv | undefined;
      const cloudflareEnv = ctx?.contextAfterGlobalMiddlewares?.cloudflareEnv;
      console.log("cloudflareEnv keys", Object.keys(cloudflareEnv ?? {}));
      console.log("binding", cloudflareEnv?.[BINDING_NAME]);
    } catch (e) {
      console.log("cloudflareEnv keys <error>", e);
    }
    try {
      const request = getRequest() as CloudflareRuntimeRequest;
      console.log(
        "request.runtime.cloudflare.env keys",
        Object.keys(request.runtime?.cloudflare?.env ?? {}),
      );
    } catch (e) {
      console.log("request.runtime.cloudflare.env keys <error>", e);
    }
    try {
      console.log(
        "globalThis.__POINTSTUDIO_WORKER_ENV__ keys",
        Object.keys(globalThis.__POINTSTUDIO_WORKER_ENV__ ?? {}),
      );
      console.log("globalThis.__env__ keys", Object.keys(globalThis.__env__ ?? {}));
    } catch (e) {
      console.log("global env keys <error>", e);
    }
    try {
      const moduleName = "cloudflare:workers";
      const mod = (await import(/* @vite-ignore */ moduleName)) as {
        env?: Record<string, unknown>;
      };
      console.log("cloudflare:workers env keys", Object.keys(mod.env ?? {}));
    } catch (e) {
      console.log("cloudflare:workers import <error>", e);
    }
  }

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
      StartContextWithCloudflareEnv | undefined;
    const fromCtx = ctx?.contextAfterGlobalMiddlewares?.cloudflareEnv?.[BINDING_NAME];
    if (isR2Bucket(fromCtx)) return fromCtx;
    const fromReq = ctx?.request?.runtime?.cloudflare?.env?.[BINDING_NAME];
    if (isR2Bucket(fromReq)) return fromReq;
  } catch {
    // Ignore and continue checking other runtime locations.
  }

  // 3) Request runtime binding
  try {
    const req = getRequest() as CloudflareRuntimeRequest;
    const fromReq = req.runtime?.cloudflare?.env?.[BINDING_NAME];
    if (isR2Bucket(fromReq)) return fromReq;
  } catch {
    // Ignore and continue checking global fallbacks.
  }

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
    throw new Error(`Cloudflare R2 binding "${BINDING_NAME}" not found in the Worker runtime`);
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

export type AssetKind = "image" | "video" | "file";

export function inferKindFromContentType(ct?: string, filename?: string): AssetKind {
  const c = (ct || "").toLowerCase();
  if (c.startsWith("image/")) return "image";
  if (c.startsWith("video/")) return "video";
  const n = (filename || "").toLowerCase();
  if (/\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)$/.test(n)) return "image";
  if (/\.(mp4|webm|mov|m4v)$/.test(n)) return "video";
  return "file";
}

function secureObjectId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure randomness unavailable for R2 key generation");
  }
  const values = new Uint8Array(16);
  globalThis.crypto.getRandomValues(values);
  values[6] = (values[6] & 0x0f) | 0x40;
  values[8] = (values[8] & 0x3f) | 0x80;
  const hex = Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Produce a predictable object key. For images this is `originals/<uuid>.<ext>`
 * so every uploaded image has its own unique original file, paired with a
 * matching `optimized/<uuid>.webp` produced by the optimize pipeline.
 * The displayed filename is stored separately in R2 customMetadata.originalName.
 */
export function makeR2Key(kind: AssetKind, filename: string): string {
  const folder = kind === "image" ? "originals" : kind === "video" ? "videos" : "files";
  const rawExt = (filename.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = rawExt || (kind === "image" ? "jpg" : kind === "video" ? "mp4" : "bin");
  const uuid = secureObjectId();
  return `${folder}/${uuid}.${ext}`;
}

/**
 * Derive the `optimized/<uuid>.webp` key that pairs with a given original key.
 * Works for the new `originals/<uuid>.<ext>` layout and any legacy image key
 * (falls back to the file's basename as the stem).
 */
export function optimizedKeyFor(originalKey: string): string {
  const base = originalKey.split("/").pop() || originalKey;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return `optimized/${stem}.webp`;
}

export async function listR2ObjectsDirect(): Promise<R2Object[]> {
  const bucket = await getBucket();
  const results: R2Object[] = [];
  let cursor: string | undefined;

  do {
    const page = await bucket.list({
      limit: 1000,
      cursor,
      include: ["httpMetadata", "customMetadata"],
    });
    for (const obj of page.objects) {
      results.push({
        key: obj.key,
        url: `${PUBLIC_URL}/${obj.key}`,
        size: obj.size,
        contentType: obj.httpMetadata?.contentType,
        lastModified: obj.uploaded instanceof Date ? obj.uploaded.toISOString() : undefined,
        originalName: obj.customMetadata?.originalName,
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
  originalName?: string,
): Promise<string> {
  const bucket = await getBucket();
  const customMetadata: Record<string, string> = {};
  if (originalName) customMetadata.originalName = originalName.slice(0, 240);
  await bucket.put(key, body, {
    httpMetadata: {
      contentType: contentType || "application/octet-stream",
      cacheControl: "public, max-age=31536000, immutable",
    },
    ...(Object.keys(customMetadata).length ? { customMetadata } : {}),
  });
  return `${PUBLIC_URL}/${key}`;
}

export async function deleteR2ObjectDirect(key: string): Promise<void> {
  const bucket = await getBucket();
  await bucket.delete(key);
}

export async function copyR2ObjectDirect(fromKey: string, toKey: string): Promise<string> {
  const bucket = await getBucket();
  const source = await bucket.get(fromKey);
  if (!source) throw new Error(`R2 copy failed: source "${fromKey}" not found`);
  const body = new Uint8Array(await source.arrayBuffer());
  await bucket.put(toKey, body, {
    httpMetadata: {
      contentType: source.httpMetadata?.contentType || "application/octet-stream",
      cacheControl: "public, max-age=31536000, immutable",
    },
    ...(source.customMetadata ? { customMetadata: source.customMetadata } : {}),
  });
  return `${PUBLIC_URL}/${toKey}`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export async function readR2ObjectDirect(key: string): Promise<{
  dataBase64: string;
  contentType: string;
  size: number;
  originalName?: string;
}> {
  const bucket = await getBucket();
  const obj = await bucket.get(key);
  if (!obj) throw new Error(`R2 object "${key}" not found in bucket ${BINDING_NAME}`);
  const bytes = new Uint8Array(await obj.arrayBuffer());
  return {
    dataBase64: bytesToBase64(bytes),
    contentType: obj.httpMetadata?.contentType || "application/octet-stream",
    size: bytes.byteLength,
    originalName: obj.customMetadata?.originalName,
  };
}
