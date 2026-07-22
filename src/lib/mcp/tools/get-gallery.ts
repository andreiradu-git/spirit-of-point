import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser, toolError, toolOk } from "../supabase";

export default defineTool({
  name: "get_gallery",
  title: "Get gallery with images",
  description: "Fetch a gallery by slug or id, including its ordered images.",
  inputSchema: {
    slug: z.string().optional().describe("Gallery slug"),
    id: z.string().uuid().optional().describe("Gallery UUID"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug, id }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    if (!slug && !id) return toolError("Provide slug or id");
    const sb = supabaseForUser(ctx);
    const q = sb.from("galleries").select("*").limit(1);
    const { data: g, error } = slug ? await q.eq("slug", slug).maybeSingle() : await q.eq("id", id!).maybeSingle();
    if (error) return toolError(error.message);
    if (!g) return toolError("Gallery not found");
    const { data: images, error: e2 } = await sb
      .from("gallery_images")
      .select("*")
      .eq("gallery_id", g.id)
      .order("position");
    if (e2) return toolError(e2.message);
    return toolOk({ ...g, images });
  },
});
