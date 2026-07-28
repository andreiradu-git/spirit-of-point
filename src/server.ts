import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, opts?: { context?: Record<string, unknown> }) => Promise<Response> | Response;
};

declare global {
  var __POINTSTUDIO_WORKER_ENV__: Record<string, unknown> | undefined;
  var __POINTSTUDIO_WORKER_RUNTIME__: string | undefined;
  var __env__: Record<string, unknown> | undefined;
}

type CloudflareRuntimeRequest = Request & {
  runtime?: {
    name?: string;
    cloudflare?: {
      env?: Record<string, unknown>;
      context?: unknown;
    };
  };
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function bindWorkerEnv(request: Request, env: unknown): Record<string, unknown> | undefined {
  const runtimeRequest = request as CloudflareRuntimeRequest;
  const rawEnv =
    asRecord(env) ?? asRecord(runtimeRequest.runtime?.cloudflare?.env) ?? asRecord(globalThis.__env__);

  if (!rawEnv) return undefined;

  globalThis.__POINTSTUDIO_WORKER_ENV__ = {
    ...(globalThis.__POINTSTUDIO_WORKER_ENV__ ?? {}),
    ...rawEnv,
  };
  globalThis.__POINTSTUDIO_WORKER_RUNTIME__ = runtimeRequest.runtime?.name ?? "cloudflare";

  // Cloudflare Workers do not populate `process.env` from the Worker's
  // secrets/bindings. Mirror the string entries so any code (including the
  // auto-generated Supabase auth middleware and other server fns) that reads
  // `process.env.<NAME>` sees the runtime values.
  try {
    if (typeof process !== "undefined" && process.env) {
      for (const [k, v] of Object.entries(rawEnv)) {
        if (typeof v === "string" && !process.env[k]) {
          (process.env as Record<string, string>)[k] = v;
        }
      }
    }
  } catch {
    // Ignore — the global mirror above still works as a fallback.
  }


  try {
    runtimeRequest.runtime = {
      ...(runtimeRequest.runtime ?? {}),
      name: runtimeRequest.runtime?.name ?? "cloudflare",
      cloudflare: {
        ...(runtimeRequest.runtime?.cloudflare ?? {}),
        env: rawEnv,
      },
    };
  } catch {
    // Some Request implementations may be non-extensible; the global binding
    // above remains the fallback for code running inside this same Worker.
  }

  return rawEnv;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const directWorkerEnv = asRecord(env);
      console.log("worker.fetch host", new URL(request.url).host);
      console.log("worker.fetch env keys", Object.keys(directWorkerEnv ?? {}));
      console.log("worker.fetch has MY_ASSETS", Boolean(directWorkerEnv?.MY_ASSETS));

      const cloudflareEnv = bindWorkerEnv(request, env);
      console.log("server.context cloudflareEnv keys", Object.keys(cloudflareEnv ?? {}));
      console.log("server.context has MY_ASSETS", Boolean(cloudflareEnv?.MY_ASSETS));

      const runtimeRequest = request as CloudflareRuntimeRequest;
      const cloudflareCtx = ctx ?? runtimeRequest.runtime?.cloudflare?.context;
      const handler = await getServerEntry();
      const response = await handler.fetch(request, {
        context: {
          ...(cloudflareEnv ? { cloudflareEnv } : {}),
          ...(cloudflareCtx ? { cloudflareCtx } : {}),
        },
      });
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
