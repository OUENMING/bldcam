import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractKeyFromUrl, uploadToR2, deleteFromR2 } from "@/lib/r2";

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

    // ── Download + rotate ────────────────────────────
    const [originalBuf, thumbBuf] = await Promise.all([
      downloadFromR2(photo.url),
      photo.thumbnailUrl ? downloadFromR2(photo.thumbnailUrl) : null,
    ]);

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

    // ── Collect old keys for cleanup ─────────────────
    const oldKeys: string[] = [];
    const mainKey = extractKeyFromUrl(photo.url);
    if (mainKey) oldKeys.push(mainKey);
    const thumbKey = photo.thumbnailUrl
      ? extractKeyFromUrl(photo.thumbnailUrl)
      : null;
    if (thumbKey) oldKeys.push(thumbKey);

    // ── Upload to new keys (bust CDN cache) ──────────
    const uuid = randomUUID();
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const newMainKey = `photos/${year}/${month}/${uuid}.webp`;
    const newThumbKey = `thumbnails/${year}/${month}/${uuid}.webp`;

    const [newMainUrl, newThumbUrl] = await Promise.all([
      uploadToR2(newMainKey, rotatedMain, "image/webp"),
      newThumbBuf
        ? uploadToR2(newThumbKey, newThumbBuf, "image/webp")
        : Promise.resolve(null),
    ]);

    // ── Update DB ────────────────────────────────────
    const swapsDimensions = normalized === 90 || normalized === 270;
    const updated = await prisma.photo.update({
      where: { id },
      data: {
        url: newMainUrl,
        thumbnailUrl: newThumbUrl ?? photo.thumbnailUrl,
        ...(swapsDimensions
          ? { width: newHeight, height: newWidth }
          : { width: newWidth, height: newHeight }),
      },
    });

    // ── Clean up old R2 files (best-effort) ──────────
    if (oldKeys.length > 0) {
      deleteFromR2(oldKeys).catch((e) =>
        console.warn("Rotate: failed to clean up old keys:", e),
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Rotate failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
