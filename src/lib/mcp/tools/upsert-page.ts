import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser, toolError, toolOk } from "../supabase";

export default defineTool({
  name: "upsert_page",
  title: "Create or update page",
  description: "Insert or update a CMS page by slug.",
  inputSchema: {
    slug: z.string(),
    title: z.string().optional(),
    seo_title: z.string().nullable().optional(),
    seo_description: z.string().nullable().optional(),
    body: z.record(z.string(), z.unknown()).optional(),
    published: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const { data, error } = await supabaseForUser(ctx)
      .from("pages")
      .upsert({ title: input.slug, ...input }, { onConflict: "slug" })
      .select()
      .single();
    if (error) return toolError(error.message);
    return toolOk(data);
  },
});
