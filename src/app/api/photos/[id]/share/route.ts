import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShareImage } from "@/lib/share";
import { uploadToR2, getShareKey, getShareUrl } from "@/lib/r2";

// ═══════════════════════════════════════════════════════
// GET /api/photos/[id]/share
//
// Generates a share card for a photo. Results are cached in R2
// at `share/{photoId}/classic.png` — subsequent requests redirect.
//
// Accept header:
//   image/*      → returns PNG directly (200)
//   text/html    → redirects to R2 URL (307)
//   other/omitted → returns JSON { url } (200)
// ═══════════════════════════════════════════════════════
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

    // ── Check R2 cache ──────────────────────────────
    const shareUrl = getShareUrl(id);
    try {
      const head = await fetch(shareUrl, { method: "HEAD" });
      if (head.ok) {
        const accept = request.headers.get("accept") || "";
        if (accept.startsWith("image/")) {
          return NextResponse.redirect(shareUrl, 307);
        }
        return NextResponse.json({ url: shareUrl, cached: true });
      }
    } catch {
      // HEAD failed — proceed to generate
    }

    // ── Download source image ──────────────────────
    const srcRes = await fetch(photo.url);
    if (!srcRes.ok) {
      return NextResponse.json(
        { error: "Source image unavailable" },
        { status: 502 },
      );
    }
    const srcBuf = Buffer.from(await srcRes.arrayBuffer());

    // ── Generate share card ─────────────────────────
    const pngBuf = await generateShareImage(photo, srcBuf);

    // ── Upload to R2 cache (async, don't block response) ──
    const shareKey = getShareKey(id);
    uploadToR2(shareKey, pngBuf, "image/png").catch((e) =>
      console.warn("Share: R2 cache upload failed:", e),
    );

    // ── Return ──────────────────────────────────────
    return new NextResponse(new Uint8Array(pngBuf), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(pngBuf.length),
      },
    });
  } catch (error) {
    console.error("Share generation failed:", error);

    // Fallback: if we have the photo, return its URL
    if (error instanceof Error && "id" in (error as any)) {
      // no-op
    }
    return NextResponse.json(
      { error: "Failed to generate share image" },
      { status: 500 },
    );
  }
}
