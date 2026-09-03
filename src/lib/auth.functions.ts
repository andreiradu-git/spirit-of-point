// Admin authentication endpoints (Cloudflare Worker + D1 only).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SessionUser = { id: string; email: string; role: string } | null;

const credentials = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(200),
});

export const getSessionUser = createServerFn({ method: "GET" }).handler(async (): Promise<SessionUser> => {
  const { currentAdmin } = await import("@/lib/auth.server");
  return currentAdmin();
});

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((input) => credentials.parse(input))
  .handler(async ({ data }): Promise<SessionUser> => {
    const { findAdminByEmail, verifyPassword, createSession } = await import("@/lib/auth.server");
    const user = await findAdminByEmail(data.email);
    if (!user || !(await verifyPassword(data.password, user.password_hash))) {
      throw new Error("Invalid email or password");
    }
    await createSession(user.id);
    return { id: user.id, email: user.email, role: user.role };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { destroyCurrentSession } = await import("@/lib/auth.server");
  await destroyCurrentSession();
  return { ok: true };
});

/**
 * Creates the very first administrator. Once one exists this endpoint always
 * fails, so it cannot be used to escalate privileges later.
 */
export const signUpFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input) => credentials.parse(input))
  .handler(async ({ data }): Promise<SessionUser> => {
    const { hasAnyAdmin, createAdminUser, createSession } = await import("@/lib/auth.server");
    if (await hasAnyAdmin()) throw new Error("An administrator already exists. Please sign in instead.");
    const user = await createAdminUser(data.email, data.password);
    await createSession(user.id);
    return user;
  });

export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { hasAnyAdmin } = await import("@/lib/auth.server");
  return { exists: await hasAnyAdmin() };
});
