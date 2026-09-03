// Cloudflare D1 access layer.
//
// Two transports, resolved at call time:
//   1. Native binding  — `env.DB` when running inside the Cloudflare Worker (production).
//   2. HTTP API        — Cloudflare's D1 REST API, used when no binding exists
//                        (local `vite dev`, scripts, CI). Requires
//                        CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / CLOUDFLARE_D1_DATABASE_ID.
//
// Production never depends on the HTTP path: the Worker binding always wins.
import { readServerEnv } from "@/lib/server-env";

export type SqlValue = string | number | null;

type D1PreparedStatement = {
  bind: (...values: SqlValue[]) => D1PreparedStatement;
  all: <T>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};
type D1Binding = { prepare: (sql: string) => D1PreparedStatement };

function bindingFromEnv(): D1Binding | undefined {
  const candidates: Array<Record<string, unknown> | undefined> = [
    globalThis.__POINTSTUDIO_WORKER_ENV__,
    globalThis.__env__,
    typeof process !== "undefined" ? (process.env as unknown as Record<string, unknown>) : undefined,
  ];
  for (const env of candidates) {
    const db = env?.["DB"];
    if (db && typeof (db as D1Binding).prepare === "function") return db as D1Binding;
  }
  return undefined;
}

async function httpQuery<T>(sql: string, params: SqlValue[]): Promise<T[]> {
  const accountId = readServerEnv("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = readServerEnv("CLOUDFLARE_API_TOKEN");
  const databaseId = readServerEnv("CLOUDFLARE_D1_DATABASE_ID");
  if (!accountId || !apiToken || !databaseId) {
    throw new Error(
      "D1 is unavailable: no DB binding and no CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / CLOUDFLARE_D1_DATABASE_ID.",
    );
  }
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    },
  );
  const json = (await res.json()) as {
    success: boolean;
    errors?: Array<{ message?: string }>;
    result?: Array<{ results?: T[] }>;
  };
  if (!json.success) {
    throw new Error(json.errors?.map((e) => e.message).join("; ") || "D1 query failed");
  }
  return json.result?.[0]?.results ?? [];
}

/** Runs a query and returns all rows. */
export async function d1All<T = Record<string, unknown>>(
  sql: string,
  params: SqlValue[] = [],
): Promise<T[]> {
  const binding = bindingFromEnv();
  if (binding) {
    const { results } = await binding.prepare(sql).bind(...params).all<T>();
    return results ?? [];
  }
  return httpQuery<T>(sql, params);
}

/** Runs a query and returns the first row, or null. */
export async function d1First<T = Record<string, unknown>>(
  sql: string,
  params: SqlValue[] = [],
): Promise<T | null> {
  const rows = await d1All<T>(sql, params);
  return rows[0] ?? null;
}

/** Runs a statement that returns no rows. */
export async function d1Run(sql: string, params: SqlValue[] = []): Promise<void> {
  const binding = bindingFromEnv();
  if (binding) {
    await binding.prepare(sql).bind(...params).run();
    return;
  }
  await httpQuery(sql, params);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function fromJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T) ?? fallback;
  try {
    const parsed = JSON.parse(value) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
