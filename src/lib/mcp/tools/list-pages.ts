import { defineTool } from "@lovable.dev/mcp-js";
import { requireAuth, supabaseForUser, toolError, toolOk } from "../supabase";

export default defineTool({
  name: "list_pages",
  title: "List pages",
  description: "List CMS pages with SEO metadata.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const { data, error } = await supabaseForUser(ctx)
      .from("pages")
      .select("id, slug, title, seo_title, seo_description, published, updated_at")
      .order("slug");
    if (error) return toolError(error.message);
    return toolOk(data);
  },
});
