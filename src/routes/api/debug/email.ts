import { createFileRoute } from "@tanstack/react-router";

// Secret-free view of the contact-notification configuration as the deployed
// Worker actually sees it. Mirrors /api/debug/ai — booleans and domains only.
export const Route = createFileRoute("/api/debug/email")({
  server: {
    handlers: {
      GET: async () => {
        const { contactEmailConfigStatus } = await import("@/lib/contact.functions");
        const status = contactEmailConfigStatus();
        console.info("[contact] email config", status);
        return Response.json(status, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
