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
// App Router handlers have no default body limit the way Pages API's 4MB did, so
// an oversized or non-image upload would be read into memory and handed to sharp.
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // `request.formData()` buffers the whole multipart body, so the file.size check
    // below protects sharp but not the process. App Router handlers have no default
    // body limit, so the cap has to come before parsing. Twice the file cap leaves
    // room for multipart framing without a second magic number.
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_UPLOAD_BYTES * 2) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES || !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file" },
        { status: file.size > MAX_UPLOAD_BYTES ? 413 : 415 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const thumbnail = await sharp(buffer)
      // The pipeline bakes EXIF orientation into the stored images; this thumbnail
      // is built from the raw upload, so without `.rotate()` the model was judging
      // a sideways photo and the title it suggested was about the wrong subject.
      .rotate()
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
