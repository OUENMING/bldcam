import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { extractKeyFromUrl } from "@/lib/r2";

// ═══════════════════════════════════════════════════════
// GET /api/photos/[id]/download
//   Proxies the photo's stored R2 image, transcodes WebP → PNG,
//   and serves it as a file download.
//   All stored images are WebP (2000px optimized via pipeline).
//   No orig format is preserved — the best available is served.
// ═══════════════════════════════════════════════════════
// A cap on what gets pulled in and what sharp will decode. Without them an
// oversized or crafted source image buffers entirely in memory, and PNG output is
// far larger than the WebP it came from.
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
// 50 megapixels: well above any phone or camera, low enough that a decompression
// bomb cannot exhaust memory.
const MAX_INPUT_PIXELS = 50_000_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const photo = await prisma.photo.findUnique({ where: { id } });
    if (!photo) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // The URL is stable but the bytes are not: rotating a photo writes a new object
    // under the same id. The old `immutable, max-age=1 year` meant a rotated photo
    // kept serving the previous PNG out of every cache for a year. Revalidating
    // against an ETag costs one conditional request, and a 304 skips sharp entirely.
    const etag = `"${photo.updatedAt.getTime().toString(36)}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    // Only ever proxy our own object storage. Two hosts count, because the table
    // holds both: objects written before the custom domain existed live on
    // `*.r2.dev` (34 of the 77 rows in production), everything since on
    // R2_PUBLIC_URL. Tightening this to the custom domain alone would break those.
    //
    // This is what actually blocks SSRF — `extractKeyFromUrl` accepts only https and
    // only those two hosts, so `http://`, `javascript:` and `169.254.169.254` all
    // fall out here. The timeout matters as much as the host check: a hung upstream
    // would otherwise hold the request open until the platform kills it.
    if (!extractKeyFromUrl(photo.url)) {
      return NextResponse.json({ error: "Invalid source URL" }, { status: 400 });
    }
    const res = await fetch(photo.url, {
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Source image unavailable" },
        { status: 502 },
      );
    }

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: "Source image too large" }, { status: 413 });
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const pngBuf = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).png().toBuffer();
    // The slug is stored data going into a response header: a quote or a CRLF in
    // it would split the header. Keep only what a filename actually needs.
    const rawName = photo.slug || photo.id;
    const filename = `${String(rawName).replace(/[^a-zA-Z0-9._-]/g, "_") || photo.id}.png`;

    return new NextResponse(new Uint8Array(pngBuf), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pngBuf.length),
        "Cache-Control": "public, max-age=0, must-revalidate",
        ETag: etag,
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
