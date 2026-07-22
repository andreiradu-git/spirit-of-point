import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser, toolError, toolOk } from "../supabase";

export default defineTool({
  name: "set_setting",
  title: "Set site setting",
  description: "Upsert a site setting by key with an arbitrary JSON value.",
  inputSchema: {
    key: z.string(),
    value: z.unknown().describe("JSON value"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ key, value }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const { data, error } = await supabaseForUser(ctx)
      .from("site_settings")
      .upsert({ key, value }, { onConflict: "key" })
      .select()
      .single();
    if (error) return toolError(error.message);
    return toolOk(data);
  },
});
