import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

const TOKEN_COOKIE = "admin-token";

/**
 * Constant-time string comparison. Both sides are hashed first so the compare
 * runs over equal-length buffers: `===` short-circuits on the first differing
 * byte, which leaks how much of the secret matched to anyone who can time it.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Verify the admin token from cookies against the fixed token in .env
 */
export async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) return false;
  return safeEqual(token, expected);
}

/**
 * Set the admin token cookie (called after successful login).
 * Returns false when ADMIN_TOKEN is missing, so the caller can fail the request
 * instead of reporting a login that never happened.
 */
export async function setAdminCookie(): Promise<boolean> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;

  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year — no need to re-login
    path: "/",
  });
  return true;
}

export { TOKEN_COOKIE };
