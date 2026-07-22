import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/settings")({
  component: () => (
    <div>
      <h1 className="font-sans font-bold uppercase text-2xl">Site settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">Coming in the next step: edit contact info, footer text, social links, WhatsApp number.</p>
    </div>
  ),
});
