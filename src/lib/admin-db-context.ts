export type AdminDb = { from: (table: string) => any };

export function requireAdminDb(context: unknown): AdminDb {
  const db = (context as { supabase?: AdminDb } | undefined)?.supabase;
  if (!db || typeof db.from !== "function") {
    throw new Response(
      JSON.stringify({
        code: "MEDIA_DB_CONTEXT_MISSING",
        message: "Admin database client was not provided by the Worker runtime context.",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  }
  return db;
}
