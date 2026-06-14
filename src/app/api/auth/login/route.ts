import { NextRequest, NextResponse } from "next/server";
import { setAdminCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD not set in .env" },
      { status: 500 },
    );
  }

  if (password !== adminPassword) {
    return NextResponse.json(
      { error: "Invalid password" },
      { status: 401 },
    );
  }

  await setAdminCookie();

  return NextResponse.json({ success: true });
}
