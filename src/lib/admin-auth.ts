import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { readServerEnv } from "@/lib/server-env";

function createSupabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

export const requireAdminAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const url = readServerEnv("SUPABASE_URL") ?? readServerEnv("VITE_SUPABASE_URL");
  const key = readServerEnv("SUPABASE_PUBLISHABLE_KEY") ?? readServerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");

  const ADMIN_BYPASS_KEY = readServerEnv("ADMIN_BYPASS_KEY");

  // If Supabase is not configured but an ADMIN_BYPASS_KEY is provided we accept
  // a single static bearer token for local/dev admin operations.
  if (!url || !key) {
    if (!ADMIN_BYPASS_KEY) {
      throw new Response(JSON.stringify({ message: "Backend auth is not configured in this runtime." }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const request = getRequest();
    const authHeader = request.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: missing admin session");
    const token = authHeader.slice("Bearer ".length);

    if (token !== ADMIN_BYPASS_KEY) throw new Error("Unauthorized: invalid admin session");

    // Minimal supabase-like stub used by downstream handlers.
    const supabaseStub: any = {
      from: (_table: string) => ({
        select: async () => ({ data: [], error: null }),
        insert: async () => ({ data: [], error: null }),
        update: async () => ({ data: [], error: null }),
        delete: async () => ({ data: [], error: null }),
        eq: function () { return this; },
        in: function () { return this; },
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
      }),
      rpc: async () => ({ data: true, error: null }),
      auth: {
        getClaims: async () => ({ data: { claims: { sub: "dev-admin" } }, error: null }),
      },
    };

    const userId = "dev-admin";
    return next({ context: { supabase: supabaseStub, userId, claims: { sub: userId } } });
  }

  const request = getRequest();
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: missing admin session");
  const token = authHeader.slice("Bearer ".length);
  if (!token || token.split(".").length !== 3) throw new Error("Unauthorized: invalid admin session");

  const supabase = createClient(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) throw new Error("Unauthorized: invalid admin session");

  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleError || !isAdmin) throw new Error("Forbidden: admin access required");

  return next({ context: { supabase, userId, claims: claimsData.claims } });
});
