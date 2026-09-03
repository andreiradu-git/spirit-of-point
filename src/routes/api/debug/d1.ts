import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/debug/d1")({
  server: {
    handlers: {
      GET: async () => {
        const { readServerEnv } = await import("@/lib/server-env");
        const { d1First, hasD1Binding, d1Transport } = await import("@/lib/d1.server");

        const info: Record<string, unknown> = {
          // Native Cloudflare D1 binding — the only transport production needs.
          hasBinding: hasD1Binding(),
          transport: d1Transport(),
          // HTTP API fallback credentials (local dev / scripts only, never required in production).
          fallback: {
            hasAccountId: Boolean(readServerEnv("CLOUDFLARE_ACCOUNT_ID")),
            hasApiToken: Boolean(readServerEnv("CLOUDFLARE_API_TOKEN")),
            hasDatabaseId: Boolean(readServerEnv("CLOUDFLARE_D1_DATABASE_ID")),
          },
        };

        try {
          const row = await d1First<{ n: number }>("SELECT COUNT(*) AS n FROM admin_users");
          info["adminCount"] = row?.n ?? null;
          info["ok"] = true;
        } catch (err) {
          info["ok"] = false;
          info["error"] = err instanceof Error ? err.message : String(err);
        }
        return Response.json(info, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
