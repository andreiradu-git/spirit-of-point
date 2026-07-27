// Server-only environment resolver.
// Cloudflare Workers do not expose secrets via `process.env` at runtime;
// `src/server.ts` mirrors the Worker env onto `globalThis.__POINTSTUDIO_WORKER_ENV__`
// so downstream code can read it uniformly across Node and Workers.

declare global {
  // eslint-disable-next-line no-var
  var __POINTSTUDIO_WORKER_ENV__: Record<string, unknown> | undefined;
  // eslint-disable-next-line no-var
  var __env__: Record<string, unknown> | undefined;
}

function nonEmpty(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function readServerEnv(name: string): string | undefined {
  const p = typeof process !== "undefined" ? process.env : undefined;
  const w = globalThis.__POINTSTUDIO_WORKER_ENV__;
  const n = globalThis.__env__;
  const imEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return (
    nonEmpty(p?.[name]) ??
    nonEmpty(w?.[name] as string | undefined) ??
    nonEmpty(n?.[name] as string | undefined) ??
    nonEmpty(imEnv?.[name])
  );
}

export function requireServerEnv(name: string): string {
  const v = readServerEnv(name);
  if (!v) throw new Error(`Missing required server env var: ${name}`);
  return v;
}
