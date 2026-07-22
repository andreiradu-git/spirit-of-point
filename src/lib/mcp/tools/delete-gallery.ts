import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser, toolError, toolOk } from "../supabase";

export default defineTool({
  name: "delete_gallery",
  title: "Delete gallery",
  description: "Delete a gallery and cascade-delete its images.",
  inputSchema: { id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const { error } = await supabaseForUser(ctx).from("galleries").delete().eq("id", id);
    if (error) return toolError(error.message);
    return toolOk({ deleted: id });
  },
});
