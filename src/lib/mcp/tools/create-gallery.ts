import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser, toolError, toolOk } from "../supabase";

export default defineTool({
  name: "create_gallery",
  title: "Create gallery",
  description: "Create a new portfolio gallery.",
  inputSchema: {
    slug: z.string().describe("URL-safe slug, unique"),
    title: z.string(),
    tagline: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ slug, title, tagline }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const { data, error } = await supabaseForUser(ctx)
      .from("galleries")
      .insert({ slug, title, tagline })
      .select()
      .single();
    if (error) return toolError(error.message);
    return toolOk(data);
  },
});
