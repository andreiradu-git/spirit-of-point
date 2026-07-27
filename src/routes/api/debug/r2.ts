import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/debug/r2")({
  server: {
    handlers: {
      GET: async () => {
        const { getR2RuntimeDiagnostics } = await import("@/lib/r2.server");
        const debug = await getR2RuntimeDiagnostics();
        console.info("R2 runtime", debug);

        return Response.json(debug, {
          headers: {
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});