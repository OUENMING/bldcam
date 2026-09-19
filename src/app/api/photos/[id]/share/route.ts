import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShareImage } from "@/lib/share";
import { uploadToR2, getShareKeyV2, getPublicUrl } from "@/lib/r2";

// ═══════════════════════════════════════════════════════
// GET /api/photos/[id]/share
//
// Generates a share card for a photo. Results are cached in R2
// at `share/{photoId}/{template}-v12.png` — subsequent requests redirect.
//
// Query parameters:
//   template   — "classic" (default, brand+EXIF) or "signature" (SVG mark)
//
// This route has exactly ONE response shape: 200 with image/png. It used to branch
// on `Accept` and 307 to the R2 object for `image/*`, which made the body depend on
// a header that says nothing about whether the client can follow a cross-origin
// redirect — R2 sends no CORS headers, so a fetch cannot, and a shared cache could
// replay a 307 to a client expecting bytes. Nothing internal relied on the redirect:
// the og:image tags point straight at the R2 URL.
// ═══════════════════════════════════════════════════════
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // ── Parse template parameter ────────────────────
    const { searchParams } = new URL(request.url);
    const template = searchParams.get("template") || "classic";
    if (template !== "classic" && template !== "signature") {
      return NextResponse.json(
        { error: "Invalid template — must be 'classic' or 'signature'" },
        { status: 400 },
      );
    }

    const photo = await prisma.photo.findUnique({ where: { id } });
    if (!photo) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ── Check R2 cache (template-aware) ────────────
    const shareKey = getShareKeyV2(id, template);
    const shareUrl = getPublicUrl(shareKey);
    try {
      const head = await fetch(shareUrl, { method: "HEAD" });
      if (head.ok) {
        // Cached: proxy the PNG so every client gets the same shape, and the CDN
        // caches the result of this route rather than only the object behind it.
        const img = await fetch(shareUrl, {
          signal: AbortSignal.timeout(15_000),
        });
        if (img.ok) {
          const buf = Buffer.from(await img.arrayBuffer());
          return new NextResponse(new Uint8Array(buf), {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }
        // CDN transient failure — fall through and regenerate
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
    const { buffer: pngBuf } = await generateShareImage(photo, srcBuf, undefined, template);

    // ── Upload to R2 cache (async, don't block response) ──
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
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate share image", detail: message },
      { status: 500 },
    );
  }
}
