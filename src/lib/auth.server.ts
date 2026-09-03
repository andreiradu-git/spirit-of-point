// Administrator authentication backed by Cloudflare D1.
//
// - Passwords: PBKDF2-SHA256 (WebCrypto), 210_000 iterations, per-user random salt.
// - Sessions:  random 32-byte token in an HttpOnly cookie; only its SHA-256 hash is stored.
// No third-party auth provider is involved; everything runs on the Worker + D1.
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { d1First, d1Run, newId, nowIso } from "@/lib/d1.server";

export const SESSION_COOKIE = "ps_session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 210_000;

export type AdminUser = { id: string; email: string; role: string };

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function unb64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations },
    key,
    256,
  );
  return b64(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${derived}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, derived] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterations || !salt || !derived) return false;
  const candidate = await pbkdf2(password, unb64(salt), Number(iterations));
  if (candidate.length !== derived.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ derived.charCodeAt(i);
  return diff === 0;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return b64(digest);
}

export async function createSession(userId: string): Promise<string> {
  const token = b64(crypto.getRandomValues(new Uint8Array(32)));
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await d1Run("INSERT INTO admin_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [
    await sha256(token),
    userId,
    expires.toISOString(),
  ]);
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return token;
}

export async function destroyCurrentSession(): Promise<void> {
  const token = getCookie(SESSION_COOKIE);
  if (token) await d1Run("DELETE FROM admin_sessions WHERE token_hash = ?", [await sha256(token)]);
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

/** Returns the signed-in admin for the current request, or null. */
export async function currentAdmin(): Promise<AdminUser | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;
  const row = await d1First<{ id: string; email: string; role: string; expires_at: string }>(
    `SELECT u.id, u.email, u.role, s.expires_at
       FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    [await sha256(token)],
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await d1Run("DELETE FROM admin_sessions WHERE token_hash = ?", [await sha256(token)]);
    return null;
  }
  return { id: row.id, email: row.email, role: row.role };
}

export async function requireAdmin(): Promise<AdminUser> {
  const admin = await currentAdmin();
  if (!admin || admin.role !== "admin") throw new Error("Unauthorized: admin session required");
  return admin;
}

export async function findAdminByEmail(email: string) {
  return d1First<{ id: string; email: string; password_hash: string; role: string }>(
    "SELECT id, email, password_hash, role FROM admin_users WHERE lower(email) = lower(?)",
    [email],
  );
}

export async function createAdminUser(email: string, password: string): Promise<AdminUser> {
  const id = newId();
  await d1Run(
    "INSERT INTO admin_users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, 'admin', ?, ?)",
    [id, email.toLowerCase(), await hashPassword(password), nowIso(), nowIso()],
  );
  return { id, email: email.toLowerCase(), role: "admin" };
}

export async function setAdminPassword(email: string, password: string): Promise<void> {
  await d1Run("UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE lower(email) = lower(?)", [
    await hashPassword(password),
    nowIso(),
    email,
  ]);
}

/** True when no administrator exists yet (first-run setup). */
export async function hasAnyAdmin(): Promise<boolean> {
  const row = await d1First<{ n: number }>("SELECT COUNT(*) AS n FROM admin_users");
  return (row?.n ?? 0) > 0;
}
