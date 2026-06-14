import { cookies } from "next/headers";

const TOKEN_COOKIE = "admin-token";

/**
 * Verify the admin token from cookies against the fixed token in .env
 */
export async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  return token === expected;
}

/**
 * Set the admin token cookie (called after successful login)
 */
export async function setAdminCookie(): Promise<void> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return;

  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year — no need to re-login
    path: "/",
  });
}

export { TOKEN_COOKIE };
