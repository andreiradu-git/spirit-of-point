import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/menu")({
  component: () => (
    <div>
      <h1 className="font-sans font-bold uppercase text-2xl">Menu</h1>
      <p className="mt-2 text-sm text-muted-foreground">Coming in the next step: add / reorder / hide header links.</p>
    </div>
  ),
});
