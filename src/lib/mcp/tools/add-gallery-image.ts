import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser, toolError, toolOk } from "../supabase";

export default defineTool({
  name: "add_gallery_image",
  title: "Add gallery image",
  description: "Append an image to a gallery. Position defaults to end.",
  inputSchema: {
    gallery_id: z.string().uuid(),
    src: z.string().describe("Image URL"),
    alt: z.string().optional(),
    title: z.string().optional(),
    position: z.number().int().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ gallery_id, src, alt, title, position }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const sb = supabaseForUser(ctx);
    let pos = position;
    if (pos === undefined) {
      const { data: last } = await sb
        .from("gallery_images")
        .select("position")
        .eq("gallery_id", gallery_id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      pos = (last?.position ?? -1) + 1;
    }
    const { data, error } = await sb
      .from("gallery_images")
      .insert({ gallery_id, src, alt, title, position: pos })
      .select()
      .single();
    if (error) return toolError(error.message);
    return toolOk(data);
  },
});
