import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser, toolError, toolOk } from "../supabase";

export default defineTool({
  name: "delete_gallery_image",
  title: "Delete gallery image",
  description: "Delete a single image from a gallery.",
  inputSchema: { id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const { error } = await supabaseForUser(ctx).from("gallery_images").delete().eq("id", id);
    if (error) return toolError(error.message);
    return toolOk({ deleted: id });
  },
});
