import sharp from "sharp";
import type { Photo } from "@prisma/client";

// ═══════════════════════════════════════════════════════
// Theme — all visual parameters in one place
// ═══════════════════════════════════════════════════════

interface ShareTheme {
  canvas: { width: number; padding: number; radius: number; textBarH: number };
  background: { blur: number; scale: number; brightness: number; saturation: number; overlayRgb: string; overlayAlpha: number };
  shadow: { blur1: number; opacity1: number; offsetY1: number; blur2: number; opacity2: number; offsetY2: number };
  typography: { brandSize: number; paramSize: number; paramGap: number; fontFamily: string; brandWeight: number; paramWeight: number };
  vignette: { opacity: number; innerStop: number };
}

const CLASSIC: ShareTheme = {
  canvas: { width: 1440, padding: 90, radius: 24, textBarH: 96 },
  background: { blur: 52, scale: 1.08, brightness: 0.88, saturation: 0.90, overlayRgb: "8,10,8", overlayAlpha: 0.12 },
  shadow: { blur1: 18, opacity1: 0.18, offsetY1: 8, blur2: 42, opacity2: 0.10, offsetY2: 18 },
  typography: { brandSize: 58, paramSize: 26, paramGap: 16, fontFamily: `"Helvetica Neue","Arial","Helvetica",sans-serif`, brandWeight: 900, paramWeight: 400 },
  vignette: { opacity: 0.10, innerStop: 60 },
};

// ═══════════════════════════════════════════════════════
// Brand display-name map — keep original casing
// ═══════════════════════════════════════════════════════

const BRAND_DISPLAY: Record<string, string> = {
  NIKON: "Nikon",
  "NIKON CORPORATION": "Nikon",
  NIKONCORPORATION: "Nikon",
  SONY: "Sony",
  CANON: "Canon",
  FUJIFILM: "FUJIFILM",
  LEICA: "Leica",
  "LEICA CAMERA AG": "Leica",
  Panasonic: "Panasonic",
  OLYMPUS: "Olympus",
  "OLYMPUS CORPORATION": "Olympus",
  PENTAX: "Pentax",
  RICOH: "Ricoh",
  HASSELBLAD: "Hasselblad",
  Apple: "Apple",
  SAMSUNG: "Samsung",
  Google: "Google",
  DJI: "DJI",
  GoPro: "GoPro",
};

function brandDisplayName(make: string | null): string | null {
  if (!make) return null;
  const trimmed = make.trim();
  return BRAND_DISPLAY[trimmed] ?? trimmed;
}

// ═══════════════════════════════════════════════════════
// EXIF formatting
// ═══════════════════════════════════════════════════════

function formatFocalLength(value: number | null | undefined): string | null {
  if (value == null) return null;
  return `${Math.round(value)}mm`;
}

function formatFNumber(value: number | null | undefined): string | null {
  if (value == null) return null;
  return `F${value}`;
}

function formatExposure(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 1) return `1/${Math.round(1 / seconds)}s`;
  if (seconds === 1) return "1s";
  return `${seconds}s`;
}

function formatIso(value: number | null | undefined): string | null {
  if (value == null) return null;
  return `ISO${value}`;
}

interface ExifSegment {
  text: string;
}

function buildExifSegments(photo: Photo): ExifSegment[] {
  const segs: ExifSegment[] = [];
  const fl = photo.focalLength35mm ?? photo.focalLength;
  const flText = formatFocalLength(fl);
  if (flText) segs.push({ text: flText });
  const fnText = formatFNumber(photo.fNumber);
  if (fnText) segs.push({ text: fnText });
  const etText = formatExposure(photo.exposureTime);
  if (etText) segs.push({ text: etText });
  const isoText = formatIso(photo.iso);
  if (isoText) segs.push({ text: isoText });
  return segs;
}

// ═══════════════════════════════════════════════════════
// XML escape
// ═══════════════════════════════════════════════════════

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ═══════════════════════════════════════════════════════
// Layout
// ═══════════════════════════════════════════════════════

interface Layout {
  canvasW: number;
  canvasH: number;
  cardW: number;
  cardH: number;
  padX: number;
  padTop: number;
  textBarH: number;
  textCenterY: number;
  radius: number;
}

function computeLayout(photoW: number, photoH: number): Layout {
  const t = CLASSIC;
  const aspect = photoW / photoH;
  const cardW = t.canvas.width - 2 * t.canvas.padding;           // 1260
  const cardH = Math.round(cardW / aspect);                       // keeps original ratio — no crop
  const canvasH = t.canvas.padding + cardH + t.canvas.textBarH + t.canvas.padding;

  return {
    canvasW: t.canvas.width,
    canvasH,
    cardW,
    cardH,
    padX: t.canvas.padding,
    padTop: t.canvas.padding,
    textBarH: t.canvas.textBarH,
    textCenterY: t.canvas.padding + cardH + Math.round(t.canvas.textBarH / 2),
    radius: t.canvas.radius,
  };
}

// ═══════════════════════════════════════════════════════
// SVG builders
// ═══════════════════════════════════════════════════════

/** Photo card with rounded corners (clipPath) — displayed at exact cardW × cardH */
function photoCardSvg(imageBase64: string, cardW: number, cardH: number, radius: number): string {
  return `<svg width="${cardW}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="rc">
        <rect width="${cardW}" height="${cardH}" rx="${radius}" ry="${radius}"/>
      </clipPath>
    </defs>
    <image href="data:image/webp;base64,${imageBase64}"
           width="${cardW}" height="${cardH}"
           preserveAspectRatio="xMidYMid meet"
           clip-path="url(#rc)"/>
  </svg>`;
}

/** Shadow: a dark rounded rect, rendered as separate layer. */
function shadowSvg(w: number, h: number, radius: number, opacity: number): string {
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="rgba(0,0,0,${opacity})"/>
  </svg>`;
}

/** Background overlay — very light tint to unify the blurred bg. */
function overlaySvg(w: number, h: number, rgb: string, alpha: number): string {
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="rgba(${rgb},${alpha})"/>
  </svg>`;
}

/** Subtle vignette for photo card — dark-green radial gradient. */
function vignetteSvg(w: number, h: number, innerStop: number, opacity: number): string {
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="vig" cx="50%" cy="50%" r="75%">
        <stop offset="${innerStop}%" stop-color="#0a0f08" stop-opacity="0"/>
        <stop offset="100%" stop-color="#0a0f08" stop-opacity="${opacity}"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#vig)"/>
  </svg>`;
}

/** EXIF text bar — transparent background, centred brand + per-field param spans. */
function exifTextSvg(canvasW: number, textBarH: number, textCenterY: number, photo: Photo): string {
  const t = CLASSIC.typography;
  const brand = brandDisplayName(photo.make);
  const segs = buildExifSegments(photo);
  const hasContent = brand || segs.length > 0;

  const displayBrand = hasContent ? (brand ?? "BLDcam") : "BLDcam";
  const cx = Math.round(canvasW / 2);
  const y = Math.round(textBarH / 2); // relative to the text bar SVG

  // Build centred group: brand on the left, params after a gap
  let textElem = "";
  if (segs.length > 0) {
    const segSpans = segs.map((s, i) => {
      const dx = i === 0 ? t.paramGap : t.paramGap;
      return `<tspan dx="${dx}" font-weight="${t.paramWeight}" font-size="${t.paramSize}" fill-opacity="0.9">${esc(s.text)}</tspan>`;
    }).join("");
    textElem =
      `<tspan font-style="italic" font-weight="${t.brandWeight}" font-size="${t.brandSize}">${esc(displayBrand)}</tspan>${segSpans}`;
  } else {
    textElem =
      `<tspan font-style="italic" font-weight="${t.brandWeight}" font-size="${t.brandSize}">${esc(displayBrand)}</tspan>`;
  }

  return `<svg width="${canvasW}" height="${textBarH}" xmlns="http://www.w3.org/2000/svg">
    <text x="${cx}" y="${y}" font-family="${t.fontFamily}" fill="#ffffff"
          text-anchor="middle" dominant-baseline="central">
      ${textElem}
    </text>
  </svg>`;
}

// ═══════════════════════════════════════════════════════
// Main pipeline
// ═══════════════════════════════════════════════════════

/**
 * Generate a share card image.
 *
 * Layer stack (bottom → top):
 *  1. Blurred + modulated background (scale 108%, blur 52, brightness 0.88)
 *  2. Tint overlay (rgba(8,10,8, 0.12))
 *  3. Shadow 1 (opacity 0.18, blur 18, offsetY 8)
 *  4. Shadow 2 (opacity 0.10, blur 42, offsetY 18)
 *  5. Photo card (rounded corners, preserve aspect ratio)
 *  6. Vignette (dark-green radial, opacity 0.10)
 *  7. EXIF text (transparent background, centred)
 */
export async function generateShareImage(
  photo: Photo,
  imageBuffer: Buffer,
): Promise<Buffer> {
  const t = CLASSIC;
  const meta = await sharp(imageBuffer).metadata();
  const photoW = meta.width ?? 1200;
  const photoH = meta.height ?? 800;
  const layout = computeLayout(photoW, photoH);

  // ── 1. Background ──────────────────────────────────
  // Slightly scale up so blur doesn't show directional edges
  const bgW = Math.round(layout.canvasW * t.background.scale);
  const bgH = Math.round(layout.canvasH * t.background.scale);
  const bgOffsetX = Math.round((bgW - layout.canvasW) / 2);
  const bgOffsetY = Math.round((bgH - layout.canvasH) / 2);

  const bgBlur = await sharp(imageBuffer)
    .resize(bgW, bgH, { fit: "cover", position: "centre" })
    .extract({ left: bgOffsetX, top: bgOffsetY, width: layout.canvasW, height: layout.canvasH })
    .blur(t.background.blur)
    .modulate({ brightness: t.background.brightness, saturation: t.background.saturation })
    .png()
    .toBuffer();

  // ── 2. Background overlay ──────────────────────────
  const overlayBuf = await sharp(
    Buffer.from(overlaySvg(layout.canvasW, layout.canvasH, t.background.overlayRgb, t.background.overlayAlpha)),
  ).png().toBuffer();

  // ── 3 & 4. Double shadow ───────────────────────────
  const s = t.shadow;
  const shadow1Buf = await sharp(
    Buffer.from(shadowSvg(layout.cardW, layout.cardH, layout.radius, s.opacity1)),
  ).blur(s.blur1).png().toBuffer();

  const shadow2Buf = await sharp(
    Buffer.from(shadowSvg(layout.cardW, layout.cardH, layout.radius, s.opacity2)),
  ).blur(s.blur2).png().toBuffer();

  // ── 5. Photo card (resized + rounded corners) ──────
  const photoResized = await sharp(imageBuffer)
    .resize(layout.cardW, layout.cardH, { fit: "fill" })
    .webp({ quality: 85 })
    .toBuffer();
  const photoBase64 = photoResized.toString("base64");
  const photoSvgStr = photoCardSvg(photoBase64, layout.cardW, layout.cardH, layout.radius);
  const photoBuf = await sharp(Buffer.from(photoSvgStr)).png().toBuffer();

  // ── 6. Vignette overlay ────────────────────────────
  const vigBuf = await sharp(
    Buffer.from(vignetteSvg(layout.cardW, layout.cardH, t.vignette.innerStop, t.vignette.opacity)),
  ).png().toBuffer();

  // ── 7. EXIF text ───────────────────────────────────
  const textSvgStr = exifTextSvg(layout.canvasW, layout.textBarH, layout.textCenterY, photo);
  const textBuf = await sharp(Buffer.from(textSvgStr)).png().toBuffer();

  // ── Final composite ────────────────────────────────
  const final = await sharp(bgBlur)
    .composite([
      { input: overlayBuf, top: 0, left: 0 },
      { input: shadow1Buf, top: layout.padTop + s.offsetY1, left: layout.padX },
      { input: shadow2Buf, top: layout.padTop + s.offsetY2, left: layout.padX },
      { input: photoBuf, top: layout.padTop, left: layout.padX },
      { input: vigBuf, top: layout.padTop, left: layout.padX },
      { input: textBuf, top: layout.padTop + layout.cardH, left: 0 },
    ])
    .png({ quality: 92 })
    .toBuffer();

  return final;
}
