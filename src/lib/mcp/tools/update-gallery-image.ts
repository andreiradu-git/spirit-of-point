import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser, toolError, toolOk } from "../supabase";

export default defineTool({
  name: "update_gallery_image",
  title: "Update gallery image",
  description: "Update src, alt, title, or position of a gallery image.",
  inputSchema: {
    id: z.string().uuid(),
    src: z.string().optional(),
    alt: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    position: z.number().int().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ id, ...patch }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const { data, error } = await supabaseForUser(ctx)
      .from("gallery_images")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) return toolError(error.message);
    return toolOk(data);
  },
});
