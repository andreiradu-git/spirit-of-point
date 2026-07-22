import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser, toolError, toolOk } from "../supabase";

export default defineTool({
  name: "reorder_gallery_images",
  title: "Reorder gallery images",
  description: "Set position for a list of gallery image IDs (0-based order).",
  inputSchema: {
    ordered_ids: z.array(z.string().uuid()).describe("Image IDs in desired order"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ ordered_ids }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const sb = supabaseForUser(ctx);
    for (let i = 0; i < ordered_ids.length; i++) {
      const { error } = await sb.from("gallery_images").update({ position: i }).eq("id", ordered_ids[i]);
      if (error) return toolError(error.message);
    }
    return toolOk({ reordered: ordered_ids.length });
  },
});
