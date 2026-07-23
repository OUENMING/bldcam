import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════════════════
// GET /api/photos/[id]/download
//   Proxies the photo's original R2 URL as a file download.
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
    const filename = photo.slug
      ? `${photo.slug}.webp`
      : `${photo.id}.webp`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
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
