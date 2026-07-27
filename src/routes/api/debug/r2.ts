import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/debug/r2")({
  server: {
    handlers: {
      GET: async () => {
        const { getR2RuntimeDebug } = await import("@/lib/r2.server");
        const debug = getR2RuntimeDebug();
        console.info("R2 runtime debug", {
          workerBindingSeen: debug.workerBindingSeen,
          available: debug.available,
          sources: debug.sources,
          resolvedNames: debug.resolvedNames,
          endpointResolvedFromAccountId: debug.endpointResolvedFromAccountId,
          r2ClientFile: debug.r2ClientFile,
        });

        return Response.json(debug.available, {
          headers: {
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});