import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser, toolError, toolOk } from "../supabase";

export default defineTool({
  name: "list_galleries",
  title: "List galleries",
  description: "List all portfolio galleries (id, slug, title, tagline).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const { data, error } = await supabaseForUser(ctx)
      .from("galleries")
      .select("id, slug, title, tagline, created_at, updated_at")
      .order("slug");
    if (error) return toolError(error.message);
    return toolOk(data);
  },
});
