import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser, toolError, toolOk } from "../supabase";

export default defineTool({
  name: "get_setting",
  title: "Get site setting",
  description: "Read a site setting by key (or list all if key omitted).",
  inputSchema: { key: z.string().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ key }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const sb = supabaseForUser(ctx);
    const q = key
      ? sb.from("site_settings").select("*").eq("key", key).maybeSingle()
      : sb.from("site_settings").select("*");
    const { data, error } = await q;
    if (error) return toolError(error.message);
    return toolOk(data);
  },
});
