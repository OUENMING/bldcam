import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractKeyFromUrl, uploadToR2 } from "@/lib/r2";

// ── Helpers ──────────────────────────────────────

async function downloadFromR2(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ═══════════════════════════════════════════════════════
// POST — rotate a photo { id: string, angle: 90 | -90 | 180 | -180 | 270 }
// ═══════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, angle } = (await request.json()) as {
      id?: string;
      angle?: number;
    };

    if (!id || !angle) {
      return NextResponse.json(
        { error: "id and angle required" },
        { status: 400 },
      );
    }

    // Valid angles: multiples of 90
    const normalized = ((angle % 360) + 360) % 360;
    if (normalized % 90 !== 0) {
      return NextResponse.json(
        { error: "Angle must be a multiple of 90" },
        { status: 400 },
      );
    }

    const photo = await prisma.photo.findUnique({ where: { id } });
    if (!photo) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ── Download original + thumbnail from R2 ──────
    const [originalBuf, thumbBuf] = await Promise.all([
      downloadFromR2(photo.url),
      photo.thumbnailUrl ? downloadFromR2(photo.thumbnailUrl) : null,
    ]);

    // ── Rotate images ───────────────────────────────
    const rotatedMain = await sharp(originalBuf)
      .rotate(normalized)
      .webp({ quality: 80 })
      .toBuffer();

    const rotatedMeta = await sharp(rotatedMain).metadata();
    const newWidth = rotatedMeta.width ?? photo.width;
    const newHeight = rotatedMeta.height ?? photo.height;

    let newThumbBuf: Buffer | null = null;
    if (thumbBuf) {
      newThumbBuf = await sharp(thumbBuf)
        .rotate(normalized)
        .webp({ quality: 75 })
        .toBuffer();
    }

    // ── Upload back to R2 (same keys) ───────────────
    const mainKey = extractKeyFromUrl(photo.url);
    const thumbKey = photo.thumbnailUrl
      ? extractKeyFromUrl(photo.thumbnailUrl)
      : null;

    if (!mainKey) {
      return NextResponse.json(
        { error: "Cannot extract R2 key from URL" },
        { status: 500 },
      );
    }

    await uploadToR2(mainKey, rotatedMain, "image/webp");
    if (thumbKey && newThumbBuf) {
      await uploadToR2(thumbKey, newThumbBuf, "image/webp");
    }

    // ── Update DB (swap width/height for 90°/270°) ──
    const swapsDimensions = normalized === 90 || normalized === 270;
    const updated = await prisma.photo.update({
      where: { id },
      data: swapsDimensions
        ? { width: newHeight, height: newWidth }
        : { width: newWidth, height: newHeight },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Rotate failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
