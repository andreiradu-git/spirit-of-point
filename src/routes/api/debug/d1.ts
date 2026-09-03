import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/debug/d1")({
  server: {
    handlers: {
      GET: async () => {
        const { readServerEnv } = await import("@/lib/server-env");
        const info: Record<string, unknown> = {
          hasBinding: false,
          hasAccountId: Boolean(readServerEnv("CLOUDFLARE_ACCOUNT_ID")),
          hasApiToken: Boolean(readServerEnv("CLOUDFLARE_API_TOKEN")),
          hasDatabaseId: Boolean(readServerEnv("CLOUDFLARE_D1_DATABASE_ID")),
        };
        try {
          const { d1First } = await import("@/lib/d1.server");
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
