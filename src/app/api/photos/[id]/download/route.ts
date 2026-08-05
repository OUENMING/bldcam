import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════════════════
// GET /api/photos/[id]/download
//   Proxies the photo's stored R2 image, transcodes WebP → PNG,
//   and serves it as a file download.
//   All stored images are WebP (2000px optimized via pipeline).
//   No orig format is preserved — the best available is served.
// ═══════════════════════════════════════════════════════
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const photo = await prisma.photo.findUnique({ where: { id } });
    if (!photo) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const res = await fetch(photo.url);
    if (!res.ok) {
      return NextResponse.json(
        { error: "Source image unavailable" },
        { status: 502 },
      );
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const pngBuf = await sharp(buffer).png().toBuffer();
    const filename = photo.slug
      ? `${photo.slug}.png`
      : `${photo.id}.png`;

    return new NextResponse(new Uint8Array(pngBuf), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pngBuf.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Download failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
