import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/debug/ai")({
  server: {
    handlers: {
      GET: async () => {
        const { getAIEnvDebug } = await import("@/lib/ai-service.server");
        const debug = getAIEnvDebug();
        console.info("AI runtime", debug);

        return Response.json(debug, {
          headers: {
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});