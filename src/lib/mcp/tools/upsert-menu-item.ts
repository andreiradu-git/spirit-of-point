import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser, toolError, toolOk } from "../supabase";

export default defineTool({
  name: "upsert_menu_item",
  title: "Create or update menu item",
  description: "Insert or update a navigation menu item. Provide id to update.",
  inputSchema: {
    id: z.string().uuid().optional(),
    label: z.string(),
    path: z.string(),
    position: z.number().int().optional(),
    visible: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const sb = supabaseForUser(ctx);
    const { id, ...values } = input;
    const query = id
      ? sb.from("menu_items").update(values).eq("id", id).select().single()
      : sb.from("menu_items").insert(values).select().single();
    const { data, error } = await query;
    if (error) return toolError(error.message);
    return toolOk(data);
  },
});
