import { defineTool } from "@lovable.dev/mcp-js";
import { requireAuth, supabaseForUser, toolError, toolOk } from "../supabase";

export default defineTool({
  name: "list_menu",
  title: "List menu items",
  description: "List navigation menu items in order.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const { data, error } = await supabaseForUser(ctx)
      .from("menu_items")
      .select("*")
      .order("position");
    if (error) return toolError(error.message);
    return toolOk(data);
  },
});
