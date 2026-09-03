// Admin authentication endpoints (Cloudflare Worker + D1 only).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SessionUser = { id: string; email: string; role: string } | null;
export type AuthResult = { user: SessionUser; error: string | null };

const credentials = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(200),
});

function failure(scope: string, error: unknown): AuthResult {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[auth] ${scope}: ${message}`);
  return { user: null, error: message };
}

export const getSessionUser = createServerFn({ method: "GET" }).handler(async (): Promise<SessionUser> => {
  try {
    const { currentAdmin } = await import("@/lib/auth.server");
    return await currentAdmin();
  } catch (error) {
    console.error(`[auth] session: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
});

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((input) => credentials.parse(input))
  .handler(async ({ data }): Promise<AuthResult> => {
    try {
      const { findAdminByEmail, verifyPassword, createSession } = await import("@/lib/auth.server");
      const user = await findAdminByEmail(data.email);
      if (!user || !(await verifyPassword(data.password, user.password_hash))) {
        return { user: null, error: "Invalid email or password" };
      }
      await createSession(user.id);
      return { user: { id: user.id, email: user.email, role: user.role }, error: null };
    } catch (error) {
      return failure("signIn", error);
    }
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { destroyCurrentSession } = await import("@/lib/auth.server");
    await destroyCurrentSession();
  } catch (error) {
    console.error(`[auth] signOut: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { ok: true };
});

/**
 * Creates the very first administrator. Once one exists this endpoint always
 * fails, so it cannot be used to escalate privileges later.
 */
export const signUpFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input) => credentials.parse(input))
  .handler(async ({ data }): Promise<AuthResult> => {
    try {
      const { hasAnyAdmin, createAdminUser, createSession } = await import("@/lib/auth.server");
      if (await hasAnyAdmin()) {
        return { user: null, error: "An administrator already exists. Please sign in instead." };
      }
      const user = await createAdminUser(data.email, data.password);
      await createSession(user.id);
      return { user, error: null };
    } catch (error) {
      return failure("signUpFirstAdmin", error);
    }
  });

export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { hasAnyAdmin } = await import("@/lib/auth.server");
    return { exists: await hasAnyAdmin(), error: null as string | null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[auth] adminExists: ${message}`);
    return { exists: false, error: message };
  }
});
