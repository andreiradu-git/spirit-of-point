import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/pages")({
  component: () => (
    <div>
      <h1 className="font-sans font-bold uppercase text-2xl">Pages</h1>
      <p className="mt-2 text-sm text-muted-foreground">Coming in the next step: edit page titles, body text and SEO.</p>
    </div>
  ),
});
