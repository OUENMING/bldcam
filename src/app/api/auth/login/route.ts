import { NextRequest, NextResponse } from "next/server";
import { safeEqual, setAdminCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    // Empty body, wrong Content-Type, malformed JSON — all of it used to escape
    // as an unhandled exception and a 500.
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    // Naming the missing variable only tells an unauthenticated caller how the
    // server is put together. Log it here, say nothing useful out there.
    console.error("Login rejected: ADMIN_PASSWORD is not set");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  if (typeof password !== "string" || !safeEqual(password, adminPassword)) {
    return NextResponse.json(
      { error: "Invalid password" },
      { status: 401 },
    );
  }

  if (!(await setAdminCookie())) {
    // setAdminCookie bails out when ADMIN_TOKEN is missing. Without this check the
    // endpoint answered { success: true } while writing no cookie at all, so the
    // admin saw a successful login and stayed locked out.
    console.error("Login rejected: ADMIN_TOKEN is not set");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
