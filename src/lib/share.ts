import sharp from "sharp";
import type { Photo } from "@prisma/client";

// ── Types ──────────────────────────────────────────

interface ShareLayout {
  canvasW: number;
  canvasH: number;
  cardW: number;
  cardH: number;
  photoH: number;
  barH: number;
  padding: number;
  radius: number;
  fontSize: { brand: number; params: number; meta: number };
}

// ── Layout computation ─────────────────────────────

function computeLayout(photoW: number, photoH: number): ShareLayout {
  const baseW = 1440;
  const padding = Math.round(baseW * 0.07);
  const cardW = baseW - 2 * padding;
  const aspect = photoW / photoH;
  const photoCardH = Math.round(cardW / aspect);
  const barH = Math.max(100, Math.min(180, Math.round(photoCardH * 0.12)));
  const cardH = photoCardH + barH;
  const canvasH = cardH + 2 * padding;

  return {
    canvasW: baseW,
    canvasH,
    cardW,
    cardH,
    photoH: photoCardH,
    barH,
    padding,
    radius: 28,
    fontSize: {
      brand: Math.max(20, Math.min(36, Math.round(barH * 0.35))),
      params: Math.max(16, Math.min(30, Math.round(barH * 0.28))),
      meta: Math.max(12, Math.min(22, Math.round(barH * 0.2))),
    },
  };
}

// ── EXIF helpers ───────────────────────────────────

function formatExp(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "";
  if (seconds < 1) {
    const d = Math.round(1 / seconds);
    return `1/${d}s`;
  }
  return seconds === 1 ? "1s" : `${seconds}s`;
}

function buildExifParamString(photo: Photo): string {
  const parts: string[] = [];
  const fl = photo.focalLength35mm ?? photo.focalLength;
  if (fl) parts.push(`${Math.round(fl)}mm`);
  if (photo.fNumber) parts.push(`F${photo.fNumber}`);
  const et = formatExp(photo.exposureTime);
  if (et) parts.push(et);
  if (photo.iso) parts.push(`ISO${photo.iso}`);
  return parts.join("  ");
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function fmtLoc(photo: Photo): string {
  return [photo.city, photo.region, photo.country].filter(Boolean).join(" · ");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── SVG builders ───────────────────────────────────

function vignetteSvg(w: number, h: number): string {
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="v" cx="50%" cy="50%" r="70%">
        <stop offset="65%" stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.35"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#v)"/>
  </svg>`;
}

function exifBarSvg(
  w: number,
  h: number,
  photo: Photo,
  fs: { brand: number; params: number; meta: number },
): string {
  const make = photo.make || "";
  const params = buildExifParamString(photo);
  const hasContent = make || params;
  const brand = hasContent ? make : "BLDcam";
  const pStr = hasContent ? `  ${params}` : "";

  const rightSegs: string[] = [];
  if (photo.dateTimeOriginal)
    rightSegs.push(fmtDate(new Date(photo.dateTimeOriginal)));
  const loc = fmtLoc(photo);
  if (loc) rightSegs.push(loc);
  const right = rightSegs.join(" · ");

  const cy = Math.round(h / 2);
  const px = Math.max(24, Math.min(40, Math.round(w * 0.03)));
  const ff = "Arial,Helvetica,'Noto Sans SC',sans-serif";

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#080808"/>
    <text x="${px}" y="${cy}" font-family="${ff}" fill="#fff" dominant-baseline="central">
      <tspan font-style="italic" font-weight="800" font-size="${fs.brand}">${esc(brand)}</tspan>
      <tspan font-weight="400" font-size="${fs.params}">${esc(pStr)}</tspan>
    </text>
    ${right ? `<text x="${w - px}" y="${cy}" font-family="${ff}"
      font-size="${fs.meta}" fill="#fff" fill-opacity="0.6"
      text-anchor="end" dominant-baseline="central">${esc(right)}</text>` : ""}
  </svg>`;
}

// ── Main ───────────────────────────────────────────

/**
 * Generate a share card image from a photo.
 * Returns a PNG Buffer ready for upload or direct response.
 *
 * Layer stack (bottom to top):
 *   1. Blurred + darkened background (full canvas)
 *   2. Card content (photo + vignette + EXIF bar, masked to rounded rect)
 */
export async function generateShareImage(
  photo: Photo,
  imageBuffer: Buffer,
): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const photoW = meta.width ?? 1200;
  const photoH = meta.height ?? 800;
  const layout = computeLayout(photoW, photoH);
  const outerPx = Math.round((layout.canvasW - layout.cardW) / 2);
  const outerPy = Math.round((layout.canvasH - layout.cardH) / 2);

  // 1. Blurred background — fill whole canvas
  const bgBlur = await sharp(imageBuffer)
    .resize(layout.canvasW, layout.canvasH, { fit: "fill" })
    .blur(60)
    .modulate({ brightness: 0.25 })
    .png()
    .toBuffer();

  // 2. Photo — resize to card width, preserve ratio
  const photoBuf = await sharp(imageBuffer)
    .resize(layout.cardW, layout.photoH, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();

  const pm = await sharp(photoBuf).metadata();
  const aW = pm.width ?? layout.cardW;
  const aH = pm.height ?? layout.photoH;
  const pOffX = Math.round((layout.cardW - aW) / 2);
  const pOffY = Math.round((layout.photoH - aH) / 2);

  // 3. Vignette overlay — radial gradient
  const vigBuf = await sharp(
    Buffer.from(vignetteSvg(layout.cardW, layout.photoH)),
  )
    .png()
    .toBuffer();

  // 4. EXIF bar — SVG with text
  const exifBuf = await sharp(
    Buffer.from(exifBarSvg(layout.cardW, layout.barH, photo, layout.fontSize)),
  )
    .png()
    .toBuffer();

  // 5. Compose card content
  const cardContent = await sharp({
    create: {
      width: layout.cardW,
      height: layout.cardH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: photoBuf, top: pOffY, left: pOffX },
      { input: vigBuf, top: 0, left: 0 },
      { input: exifBuf, top: layout.photoH, left: 0 },
    ])
    .png()
    .toBuffer();

  // 6. Rounded-corner mask
  const maskSvg = `<svg width="${layout.cardW}" height="${layout.cardH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${layout.cardW}" height="${layout.cardH}" rx="${layout.radius}" fill="white"/>
  </svg>`;

  const maskedCard = await sharp(cardContent)
    .composite([
      {
        input: Buffer.from(maskSvg),
        top: 0,
        left: 0,
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  // 7. Final composite: background + card
  const result = await sharp(bgBlur)
    .composite([{ input: maskedCard, top: outerPy, left: outerPx }])
    .png({ quality: 90 })
    .toBuffer();

  return result;
}
