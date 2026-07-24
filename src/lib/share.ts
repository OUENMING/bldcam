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
    /** Photo card corner radius (squircle continuous corner) */
    radius: 24,
    /** Vertical space reserved for EXIF text below the photo card */
    textBarH: 120,
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

  // ── Optical shadow (SVG feDropShadow — true Gaussian) ──
  //
  //   Uses SVG feDropShadow filter which is a true Gaussian-based
  //   drop shadow (same algorithm as Canvas 2D ctx.shadowBlur).
  //   This produces a natural optical shadow that casts from the
  //   photo's alpha channel, NOT a blurred black rectangle.
  //
  //   Three chained feDropShadows in one filter:
  //     Ring 1 → tightest core, establishes card thickness
  //     Ring 2 → main ambient spread, creates elevation
  //     Ring 3 → widest fade, melts into background
  shadow: {
    /** Core shadow — establishes photo has thickness */
    ring1: { stdDev: 2, offsetY: 4, opacity: 0.25 },
    /** Ambient — main floating depth, downward directional */
    ring2: { stdDev: 8, offsetY: 14, opacity: 0.09 },
    /** Dissolve — wide fade with no visible end */
    ring3: { stdDev: 24, offsetY: 34, opacity: 0.035 },
  },

  // ── Typography ───────────────────────────────────
  typography: {
    /** Camera brand font size */
    brandSize: 52,
    /** EXIF parameter font size */
    paramSize: 24,
    /** Horizontal gap between brand name and first parameter (SVG dx) */
    paramGap: 18,
    /** Brand font: serif for photographic brand identity (Cormorant Garamond style) */
    brandFont: `'DejaVu Serif','Georgia','Times New Roman',serif`,
    /** EXIF font: clean sans-serif for parameters */
    paramFont: `'Helvetica Neue',Arial,sans-serif`,
    /** Brand name: bold italic 700 (serif) */
    brandWeight: 700,
    /** EXIF params: regular 400 (sans) */
    paramWeight: 400,
    /** EXIF params opacity */
    paramOpacity: 0.80,
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

/** SVG feDropShadow filter — 3-ring Gaussian optical shadow.
 *  Equivalent to LensBorder-Pro's Canvas ctx.shadowBlur approach.
 *  All 3 rings are chained in one filter, casting from the photo's alpha channel. */
function buildShadowFilter(theme: ShareTheme): string {
  const { ring1, ring2, ring3 } = theme.shadow;
  return `<filter id="sh" x="-40%" y="-40%" width="180%" height="180%">
    <feDropShadow dx="0" dy="${ring1.offsetY}" stdDeviation="${ring1.stdDev}" flood-color="#000" flood-opacity="${ring1.opacity}"/>
    <feDropShadow dx="0" dy="${ring2.offsetY}" stdDeviation="${ring2.stdDev}" flood-color="#000" flood-opacity="${ring2.opacity}"/>
    <feDropShadow dx="0" dy="${ring3.offsetY}" stdDeviation="${ring3.stdDev}" flood-color="#000" flood-opacity="${ring3.opacity}"/>
  </filter>`;
}

/** Continuous corner path (squircle / superellipse).
 *  Uses cubic bezier control points to approximate Apple-style
 *  continuous curvature instead of traditional circular arcs. */
function squirclePath(w: number, h: number, r: number): string {
  const c = r * 0.45; // control point factor — 0.45 ≈ Apple squircle
  return `M ${r} 0
    C ${r + c} 0, ${w - c} 0, ${w - r} 0
    C ${w} ${c * 0.55}, ${w} ${r + c}, ${w} ${r}
    L ${w} ${h - r}
    C ${w} ${h - c}, ${w - c} ${h}, ${w - r} ${h}
    L ${r} ${h}
    C ${c} ${h}, 0 ${h - c}, 0 ${h - r}
    L 0 ${r}
    C 0 ${c}, ${c} 0, ${r} 0 Z`;
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
  // Center text vertically within the footer bar
  const y = Math.round(textBarH / 2);

  // Brand span — serif italic bold
  const brandSpan =
    `<tspan font-family="${ty.brandFont}" font-style="italic" font-weight="${ty.brandWeight}" font-size="${ty.brandSize}">${esc(displayBrand)}</tspan>`;

  // Parameter spans — sans regular, each with fixed dx spacing
  const paramSpans = segs.map((s, i) => {
    const dx = i === 0 ? ty.paramGap : ty.paramGap;
    return `<tspan dx="${dx}" font-family="${ty.paramFont}" font-weight="${ty.paramWeight}" font-size="${ty.paramSize}" opacity="${ty.paramOpacity}">${esc(s.text)}</tspan>`;
  }).join("");

  return `<svg width="${canvasW}" height="${textBarH}" xmlns="http://www.w3.org/2000/svg">
    <text x="${cx}" y="${y}"
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

// ── Photo + Shadow Renderer ──────────────────────
//   SVG feDropShadow filter casts a true Gaussian shadow directly
//   from the photo's alpha channel. No separate shadow layers needed.
//   This produces the same natural optical shadow as LensBorder-Pro
//   and Canvas 2D ctx.shadowBlur — NOT a blurred black rectangle.

async function renderPhoto(
  imageBuffer: Buffer,
  layout: Layout,
  theme: ShareTheme,
): Promise<Buffer> {
  const { cardW, cardH, radius } = layout;

  // Resize — "inside" preserves aspect ratio
  const resized = await sharp(imageBuffer)
    .resize(cardW, cardH, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  const meta = await sharp(resized).metadata();
  const aW = meta.width ?? cardW;
  const aH = meta.height ?? cardH;
  const offX = Math.round((cardW - aW) / 2);
  const offY = Math.round((cardH - aH) / 2);
  const base64 = resized.toString("base64");

  // SVG with continuous corners (squircle) + 3-ring Gaussian drop shadow
  const filter = buildShadowFilter(theme);
  const clipPath = squirclePath(cardW, cardH, radius);
  const svg = `<svg width="${cardW}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="cr"><path d="${clipPath}"/></clipPath>
      ${filter}
    </defs>
    <image href="data:image/png;base64,${base64}" x="${offX}" y="${offY}" width="${aW}" height="${aH}" clip-path="url(#cr)" filter="url(#sh)"/>
  </svg>`;

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
  photoCard: Buffer,
  typography: Buffer,
  layout: Layout,
  theme: ShareTheme,
): Promise<Buffer> {
  const { padX, padTop, cardH } = layout;

  const layers: sharp.OverlayOptions[] = [];

  if (overlay) {
    layers.push({ input: overlay, top: 0, left: 0 });
  }

  // Photo card (shadow is baked into the SVG via feDropShadow filter)
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
 *   Shadow         → SVG feDropShadow (true Gaussian, baked into photo card)
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

  // Step 1–4: run independent renderers in parallel
  const [background, overlay, photoCard, typography] = await Promise.all([
    renderBackground(imageBuffer, layout, theme),
    renderOverlay(layout, theme),
    renderPhoto(imageBuffer, layout, theme),
    renderTypography(layout, photo, theme),
  ]);

  // Step 5: layer them back-to-front (shadow is baked into photoCard SVG)
  const buffer = await renderComposite(
    background,
    overlay,
    photoCard,
    typography,
    layout,
    theme,
  );

  return { buffer, layout };
}
