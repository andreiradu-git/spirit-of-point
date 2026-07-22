import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser, toolError, toolOk } from "../supabase";

export default defineTool({
  name: "update_gallery",
  title: "Update gallery",
  description: "Update a gallery's title, slug, or tagline.",
  inputSchema: {
    id: z.string().uuid(),
    slug: z.string().optional(),
    title: z.string().optional(),
    tagline: z.string().nullable().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ id, ...patch }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const { data, error } = await supabaseForUser(ctx)
      .from("galleries")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) return toolError(error.message);
    return toolOk(data);
  },
});
