// Server-function middleware: requires a valid administrator session.
// Sessions live in Cloudflare D1 and are carried by an HttpOnly cookie.
import { createMiddleware } from "@tanstack/react-start";
import { currentAdmin } from "@/lib/auth.server";

export const requireAdminAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const admin = await currentAdmin();
  if (!admin || admin.role !== "admin") {
    throw new Response(JSON.stringify({ message: "Administrator sign-in required." }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return next({ context: { admin, userId: admin.id } });
});
