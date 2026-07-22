import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/galleries")({
  component: () => (
    <div>
      <h1 className="font-sans font-bold uppercase text-2xl">Galleries</h1>
      <p className="mt-2 text-sm text-muted-foreground">Coming in the next step: upload, order and label photos per category.</p>
    </div>
  ),
});
