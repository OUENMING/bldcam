import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { isAdmin } from "@/lib/auth";
import { suggestMetadata } from "@/lib/ai";

// ═══════════════════════════════════════════════════════
// POST — AI title & category suggestion (Volcengine Ark)
//
//   Accepts: multipart/form-data { file }
//   Returns: { suggestedTitle: string | null, suggestedCategory: string | null }
//
//   Creates 512px thumbnail → base64 → Doubao Responses API.
//   On ANY failure returns nulls — never blocks upload.
// ═══════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const thumbnail = await sharp(buffer)
      .resize(512, 512, { fit: "inside" })
      .webp({ quality: 60 })
      .toBuffer();

    const base64 = thumbnail.toString("base64");
    const suggestion = await suggestMetadata(base64, "image/webp");

    return NextResponse.json(suggestion);
  } catch (error) {
    console.warn("Suggest endpoint failed:", error);
    return NextResponse.json({
      suggestedTitle: null,
      suggestedCategory: null,
    });
  }
}
