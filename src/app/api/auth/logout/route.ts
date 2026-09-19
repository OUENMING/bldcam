import { NextRequest, NextResponse } from "next/server";
import { TOKEN_COOKIE } from "@/lib/auth";

// A logout is a bare POST with no body, so any other site can fire one from a
// form or an image tag. Check where it came from before clearing the session.
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  // Same-origin requests may omit Origin; a cross-site one always sends it.
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const response = NextResponse.json({ success: true });
  // TOKEN_COOKIE, not a literal: this is the same name setAdminCookie writes, and
  // a typo here would leave the session cookie in place while reporting success.
  response.cookies.set(TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
