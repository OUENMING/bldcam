import sharp from "sharp";
import type { Photo } from "@prisma/client";

// ═══════════════════════════════════════════════════════════
// THEME — canonical source of all visual parameters
//
// To calibrate against a reference image:
//   1. Overlay the generated PNG on the reference in any photo editor
//   2. Use "Difference" blend mode — pure black = perfect match
//   3. Blink-comparison (toggle visibility) reveals size/position issues
//   4. Tweak the values below — never change renderer code
//
// Every visual number lives here. No renderer has hardcoded values.
// ═══════════════════════════════════════════════════════════

export const CLASSIC_THEME = {
  // ── Canvas ──────────────────────────────────────
  canvas: {
    /** Canonical width in px — all layout derives from this */
    width: 1440,
    /** Uniform inset from canvas edges for photo card */
    padding: 90,
    /** Photo card corner radius */
    radius: 24,
    /** Vertical space reserved for EXIF text below the photo card */
    textBarH: 96,
  },

  // ── Background (generated from the photo itself) ──
  background: {
    /**
     * Gaussian blur sigma in px.
     * Higher = softer mood / Lower = more recognizable background.
     * Calibrate by comparing edge softness between generated and reference.
     */
    blur: 52,
    /**
     * Scale factor before blur. >1 prevents blur edge artifacts
     * (directional smearing near canvas borders).
     */
    scale: 1.08,
    /**
     * Brightness multiplier. 0.88 = 88% of original luminance.
     * Keep the background visible but subdued — don't crush to black.
     */
    brightness: 0.88,
    /**
     * Saturation multiplier. 0.90 = very slightly desaturated.
     * Prevents the blurred background from competing with the photo.
     */
    saturation: 0.90,
  },

  // ── Tonal overlay (unifies background, not a vignette) ──
  overlay: {
    /**
     * Solid tint over the entire background canvas.
     * Purpose: subtly unify bg luminance so no region is distractingly bright.
     * This is NOT a vignette — there is no radial falloff.
     * Set alpha to 0 to disable.
     */
    rgb: "8,10,8",
    alpha: 0.06,
  },

  // ── Optical shadow (3-layer light-from-above model) ──
  //
  //   Light source: overhead. Shadow extends downward.
  //   Each layer has a distinct role, mimicking real-world light propagation.
  //
  //   Contact  — tightest, densest, closest to the photo.
  //              Establishes the photo has physical thickness.
  //   Ambient  — main directional spread, medium opacity.
  //              Creates the "floating card above surface" illusion.
  //   Falloff  — widest, very faint. No visible boundary.
  //              Fades so gradually the viewer only senses it melting out.
  shadow: {
    /** Tight shadow — photo thickness */
    contact:  { blur: 6,  opacity: 0.20, offsetY: 4 },
    /** Main floating depth — directional, extends downward */
    ambient:  { blur: 28, opacity: 0.11, offsetY: 14 },
    /** Gradual fade — melts into background, no visible end */
    falloff:  { blur: 68, opacity: 0.05, offsetY: 30 },
  },

  // ── Typography ───────────────────────────────────
  typography: {
    /** Camera brand font size */
    brandSize: 58,
    /** EXIF parameter font size */
    paramSize: 26,
    /** Horizontal gap between brand name and first parameter (SVG dx) */
    paramGap: 18,
    /** Font stack — Helvetica Neue preferred, graceful fallback to Arial */
    fontFamily: `'Helvetica Neue',Arial,Helvetica,sans-serif`,
    /** Brand name: italic 900 for bold photographic identity */
    brandWeight: 900,
    /** EXIF params: regular 400 for clean data presentation */
    paramWeight: 400,
    /** EXIF params opacity — slightly less than the pure-white brand name */
    paramOpacity: 0.82,
  },

  // ── Output ───────────────────────────────────────
  output: {
    /** PNG compression quality 0-100 */
    quality: 92,
  },
} as const;

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type ShareTheme = typeof CLASSIC_THEME;

/** Layout computed from a specific photo's dimensions */
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

interface ExifSegment {
  text: string;
}

// ═══════════════════════════════════════════════════════════
// BRAND MAP — keep manufacturer identity, not raw EXIF string
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// LAYOUT ENGINE
//   Input: photo width, photo height
//   Output: Layout (canvasH is auto-computed from photo aspect)
// ═══════════════════════════════════════════════════════════

function computeLayout(photoW: number, photoH: number, theme: ShareTheme): Layout {
  const { width, padding, radius, textBarH } = theme.canvas;
  const aspect = photoW / photoH;

  // Card always fills canvas-width minus padding; height derives from aspect
  const cardW = width - 2 * padding;
  const cardH = Math.round(cardW / aspect);

  // Canvas height = top padding + card + text bar + bottom padding
  const canvasH = padding + cardH + textBarH + padding;

  return {
    canvasW: width,
    canvasH,
    cardW,
    cardH,
    padX: padding,
    padTop: padding,
    textBarH,
    textCenterY: padding + cardH + Math.round(textBarH * 0.55),
    radius,
  };
}

// ═══════════════════════════════════════════════════════════
// EXIF FORMATTERS — each parameter has a dedicated formatter
// ═══════════════════════════════════════════════════════════

function formatFocalLength(v: number | null | undefined): string | null {
  if (v == null) return null;
  return `${Math.round(v)}mm`;
}

function formatFNumber(v: number | null | undefined): string | null {
  if (v == null) return null;
  return `F${v}`;
}

function formatExposure(v: number | null | undefined): string | null {
  if (!v || v <= 0) return null;
  if (v < 1) return `1/${Math.round(1 / v)}s`;
  if (v === 1) return "1s";
  return `${v}s`;
}

function formatIso(v: number | null | undefined): string | null {
  if (v == null) return null;
  return `ISO${v}`;
}

function buildExifSegments(photo: Photo): ExifSegment[] {
  const segs: ExifSegment[] = [];
  const fl = photo.focalLength35mm ?? photo.focalLength;
  const t = formatFocalLength(fl);
  if (t) segs.push({ text: t });
  const t2 = formatFNumber(photo.fNumber);
  if (t2) segs.push({ text: t2 });
  const t3 = formatExposure(photo.exposureTime);
  if (t3) segs.push({ text: t3 });
  const t4 = formatIso(photo.iso);
  if (t4) segs.push({ text: t4 });
  return segs;
}

// ═══════════════════════════════════════════════════════════
// XML ESCAPE
// ═══════════════════════════════════════════════════════════

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ═══════════════════════════════════════════════════════════
// ── SVG PRIMITIVES ────────────────────────────────────────
//   Each SVG builder returns a string. Sharp renders it to PNG.
// ═══════════════════════════════════════════════════════════

/** Rounded-rect clip path wrapping a base64-encoded photo image.
 *  preserveAspectRatio="xMidYMid meet" — never crop, no stretch. */
function buildPhotoCardSvg(
  imageBase64: string,
  cardW: number,
  cardH: number,
  radius: number,
): string {
  return `<svg width="${cardW}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="cr">
        <rect width="${cardW}" height="${cardH}" rx="${radius}" ry="${radius}"/>
      </clipPath>
    </defs>
    <image href="data:image/webp;base64,${imageBase64}"
           width="${cardW}" height="${cardH}"
           preserveAspectRatio="xMidYMid meet"
           clip-path="url(#cr)"/>
  </svg>`;
}

/** A rounded rect filled with black at a given opacity — used for shadow layers. */
function buildShadowSvg(w: number, h: number, radius: number, opacity: number): string {
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="rgba(0,0,0,${opacity})"/>
  </svg>`;
}

/** Full-canvas solid rect — tonal overlay to unify background brightness. */
function buildOverlaySvg(w: number, h: number, rgb: string, alpha: number): string {
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="rgba(${rgb},${alpha})"/>
  </svg>`;
}

/** EXIF text bar — transparent background, horizontal centre-aligned.
 *  Brand name (italic 900) + per-parameter spans (regular 400) in one line.
 *  Each parameter is a separate <tspan> so a missing field doesn't break layout. */
function buildExifTextSvg(
  canvasW: number,
  textBarH: number,
  photo: Photo,
  theme: ShareTheme,
): string {
  const ty = theme.typography;
  const brand = brandDisplayName(photo.make);
  const segs = buildExifSegments(photo);
  const hasContent = brand || segs.length > 0;
  const displayBrand = hasContent ? (brand ?? "BLDcam") : "BLDcam";

  const cx = Math.round(canvasW / 2);
  const y = Math.round(textBarH / 2);

  // Brand span
  const brandSpan =
    `<tspan font-style="italic" font-weight="${ty.brandWeight}" font-size="${ty.brandSize}">${esc(displayBrand)}</tspan>`;

  // Parameter spans — each gets dx="${paramGap}" so a missing field doesn't collapse spacing
  const paramSpans = segs.map((s, i) => {
    const dx = i === 0 ? ty.paramGap : ty.paramGap;
    return `<tspan dx="${dx}" font-weight="${ty.paramWeight}" font-size="${ty.paramSize}" opacity="${ty.paramOpacity}">${esc(s.text)}</tspan>`;
  }).join("");

  return `<svg width="${canvasW}" height="${textBarH}" xmlns="http://www.w3.org/2000/svg">
    <text x="${cx}" y="${y}"
          font-family="${ty.fontFamily}"
          fill="#ffffff"
          text-anchor="middle">
      ${brandSpan}${paramSpans}
    </text>
  </svg>`;
}

// ═══════════════════════════════════════════════════════════
// ── RENDERERS ─────────────────────────────────────────────
//   Each renderer takes inputs → produces a PNG Buffer.
//   They are called by the CompositeRenderer in order.
// ═══════════════════════════════════════════════════════════

// ── Background Renderer ───────────────────────────

async function renderBackground(
  imageBuffer: Buffer,
  layout: Layout,
  theme: ShareTheme,
): Promise<Buffer> {
  const { scale, blur, brightness, saturation } = theme.background;

  // Scale up before blur to avoid directional edge smearing
  const bgW = Math.round(layout.canvasW * scale);
  const bgH = Math.round(layout.canvasH * scale);
  const offsetX = Math.round((bgW - layout.canvasW) / 2);
  const offsetY = Math.round((bgH - layout.canvasH) / 2);

  return sharp(imageBuffer)
    .resize(bgW, bgH, { fit: "cover", position: "centre" })
    .extract({ left: offsetX, top: offsetY, width: layout.canvasW, height: layout.canvasH })
    .blur(blur)
    .modulate({ brightness, saturation })
    .png()
    .toBuffer();
}

// ── Overlay Renderer ──────────────────────────────
//   Optional. Set overlay.alpha = 0 in theme to disable.

async function renderOverlay(
  layout: Layout,
  theme: ShareTheme,
): Promise<Buffer | null> {
  const { alpha } = theme.overlay;
  if (alpha <= 0) return null;

  return sharp(
    Buffer.from(buildOverlaySvg(layout.canvasW, layout.canvasH, theme.overlay.rgb, alpha)),
  ).png().toBuffer();
}

// ── Shadow Renderer ───────────────────────────────
//   Three-layer optical shadow: contact → ambient → falloff.
//   Each layer has increasing blur and decreasing opacity,
//   mimicking real-world light propagation from an overhead source.

interface ShadowBuffers {
  contact: Buffer;
  ambient: Buffer;
  falloff: Buffer;
}

async function renderShadows(
  layout: Layout,
  theme: ShareTheme,
): Promise<ShadowBuffers> {
  const { cardW, cardH, radius } = layout;
  const { contact, ambient, falloff } = theme.shadow;

  const [buf1, buf2, buf3] = await Promise.all([
    sharp(Buffer.from(buildShadowSvg(cardW, cardH, radius, contact.opacity)))
      .blur(contact.blur)
      .png()
      .toBuffer(),
    sharp(Buffer.from(buildShadowSvg(cardW, cardH, radius, ambient.opacity)))
      .blur(ambient.blur)
      .png()
      .toBuffer(),
    sharp(Buffer.from(buildShadowSvg(cardW, cardH, radius, falloff.opacity)))
      .blur(falloff.blur)
      .png()
      .toBuffer(),
  ]);

  return { contact: buf1, ambient: buf2, falloff: buf3 };
}

// ── Photo Renderer ────────────────────────────────
//   Resizes photo to exact card dimensions (width fills, height from aspect),
//   then clips to rounded rect via SVG clipPath.

async function renderPhoto(
  imageBuffer: Buffer,
  layout: Layout,
): Promise<Buffer> {
  const { cardW, cardH, radius } = layout;

  const resized = await sharp(imageBuffer)
    .resize(cardW, cardH, { fit: "fill" })
    .webp({ quality: 85 })
    .toBuffer();

  const base64 = resized.toString("base64");
  const svg = buildPhotoCardSvg(base64, cardW, cardH, radius);

  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Typography Renderer ───────────────────────────

async function renderTypography(
  layout: Layout,
  photo: Photo,
  theme: ShareTheme,
): Promise<Buffer> {
  const svg = buildExifTextSvg(layout.canvasW, layout.textBarH, photo, theme);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Composite Renderer ────────────────────────────

async function renderComposite(
  background: Buffer,
  overlay: Buffer | null,
  shadows: ShadowBuffers,
  photoCard: Buffer,
  typography: Buffer,
  layout: Layout,
  theme: ShareTheme,
): Promise<Buffer> {
  const { padX, padTop, cardH } = layout;
  const { contact, ambient, falloff } = theme.shadow;

  const layers: sharp.OverlayOptions[] = [];

  // Optional tonal overlay
  if (overlay) {
    layers.push({ input: overlay, top: 0, left: 0 });
  }

  // Three-layer optical shadow — bottom to top: falloff → ambient → contact
  // Each with progressively larger Y offset (light from above)
  layers.push({ input: shadows.falloff, top: padTop + falloff.offsetY, left: padX });
  layers.push({ input: shadows.ambient, top: padTop + ambient.offsetY, left: padX });
  layers.push({ input: shadows.contact, top: padTop + contact.offsetY, left: padX });

  // Photo card
  layers.push({ input: photoCard, top: padTop, left: padX });

  // EXIF text below the card
  layers.push({ input: typography, top: padTop + cardH, left: 0 });

  return sharp(background)
    .composite(layers)
    .png({ quality: theme.output.quality })
    .toBuffer();
}

// ═══════════════════════════════════════════════════════════
// ── PUBLIC API ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export interface ShareResult {
  buffer: Buffer;
  layout: Layout;
}

/**
 * Generate a share card image.
 *
 * Pipeline:
 *   Layout Engine  → computes canvas & card dimensions
 *   Background     → blurred, desaturated from photo
 *   Overlay        → optional tonal unification (not a vignette)
 *   Shadow         → double floating-card shadow
 *   Photo          → resized + rounded corners, no crop
 *   Typography     → centred single-line EXIF text on transparent bg
 *   Composite      → assembles all layers bottom-to-top
 *
 * Pass a different `theme` to calibrate or create variants.
 */
export async function generateShareImage(
  photo: Photo,
  imageBuffer: Buffer,
  theme: ShareTheme = CLASSIC_THEME,
): Promise<ShareResult> {
  // Step 0: measure photo → compute layout
  const meta = await sharp(imageBuffer).metadata();
  const layout = computeLayout(meta.width ?? 1200, meta.height ?? 800, theme);

  // Step 1–5: run independent renderers in parallel where possible
  const [background, overlay, shadows, photoCard, typography] = await Promise.all([
    renderBackground(imageBuffer, layout, theme),
    renderOverlay(layout, theme),
    renderShadows(layout, theme),
    renderPhoto(imageBuffer, layout),
    renderTypography(layout, photo, theme),
  ]);

  // Step 6: layer them back-to-front
  const buffer = await renderComposite(
    background,
    overlay,
    shadows,
    photoCard,
    typography,
    layout,
    theme,
  );

  return { buffer, layout };
}
