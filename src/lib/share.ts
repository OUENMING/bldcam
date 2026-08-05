import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";
import type { Photo } from "@prisma/client";
import { brandDisplayName, cleanModel } from "@/lib/format";

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
    /** Font stack — modern system sans-serif */
    fontFamily: `system-ui,-apple-system,BlinkMacSystemFont,SF Pro Display,Roboto,Helvetica,Arial,sans-serif`,
    /** Brand name font size (uppercase) */
    brandSize: 32,
    /** Brand name weight (extrabold) */
    brandWeight: 800,
    /** Brand letter-spacing */
    brandLetterSpacing: 1,
    /** EXIF parameter font size */
    paramSize: 21,
    /** EXIF parameter weight (light) */
    paramWeight: 300,
    /** EXIF letter-spacing */
    paramLetterSpacing: 1.5,
    /** EXIF line opacity */
    paramOpacity: 0.65,
    /** Vertical Y offset for brand line (dominant-baseline: middle) */
    brandLineY: 48,
    /** Vertical Y offset for EXIF parameter line */
    exifLineY: 82,
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

// ═══════════════════════════════════════════════════════════
// SIGNATURE — visual parameters for the signature template
// ═══════════════════════════════════════════════════════════

export const SIGNATURE = {
  /** Fixed target height in px — decoupled from textBarH */
  targetHeight: 90,
  /** SVG file path relative to process.cwd() */
  svgPath: "public/signature.svg",
  /** Dark colors for light backgrounds */
  darkColors: { primary: "#1c1c1c", secondary: "#666666" },
  /** Light colors for dark backgrounds */
  lightColors: { primary: "#ffffff", secondary: "#999999" },
  /** Brightness threshold 0-255 */
  brightnessThreshold: 128,
} as const;

/** Layout computed from a specific photo's dimensions */
interface Layout {
  canvasW: number;
  canvasH: number;
  cardW: number;
  cardH: number;
  padX: number;
  padTop: number;
  textBarH: number;
  radius: number;
}

interface ExifSegment {
  text: string;
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
  return `F${Math.round(v * 10) / 10}`;
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
  const model = cleanModel(photo.model, photo.make, brand);

  const cx = Math.round(canvasW / 2);
  const line1Y = ty.brandLineY;
  const line2Y = ty.exifLineY;

  // Line 1: brand (heavy) + optional model (light), as plain text — no <tspan>
  const line1 = model
    ? `${esc(displayBrand.toUpperCase())}  ${esc(model)}`
    : `${esc(displayBrand.toUpperCase())}`;

  // Line 2: EXIF params
  const exifText = segs.map((s) => s.text).join("  ");

  return `<svg width="${canvasW}" height="${textBarH}" xmlns="http://www.w3.org/2000/svg">
    <text x="${cx}" y="${line1Y}" fill="#ffffff" text-anchor="middle" dominant-baseline="middle"
          font-family="${ty.fontFamily}" font-weight="${ty.brandWeight}" font-size="${ty.brandSize}" letter-spacing="${ty.brandLetterSpacing}">
      ${line1}
    </text>
    ${exifText ? `<text x="${cx}" y="${line2Y}" fill="#ffffff" text-anchor="middle" dominant-baseline="middle"
          font-family="${ty.fontFamily}" font-weight="${ty.paramWeight}" font-size="${ty.paramSize}" letter-spacing="${ty.paramLetterSpacing}" opacity="${ty.paramOpacity}">
      ${esc(exifText)}
    </text>` : ''}
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

  // 1. Rotate + resize in a single pipeline, get buffer + dimensions at once
  const { data: resized, info } = await sharp(imageBuffer)
    .rotate()
    .resize(cardW, cardH, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });

  const aW = info.width;
  const aH = info.height;
  const offX = Math.round((cardW - aW) / 2);
  const offY = Math.round((cardH - aH) / 2);
  const base64 = resized.toString("base64");

  // 2. SVG with squircle clip + 3-ring shadow + subtle border
  const filter = buildShadowFilter(theme);
  const clipPath = squirclePath(aW, aH, radius);
  const svg = `<svg width="${cardW}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="cr"><path d="${clipPath}"/></clipPath>
      ${filter}
    </defs>
    <g transform="translate(${offX}, ${offY})">
      <image href="data:image/png;base64,${base64}"
             x="0" y="0" width="${aW}" height="${aH}"
             clip-path="url(#cr)" filter="url(#sh)"/>
      <rect x="0" y="0" width="${aW}" height="${aH}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" clip-path="url(#cr)"/>
    </g>
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

// ── Signature Renderer ────────────────────────────
//   Reads the SVG file, adapts color based on background brightness,
//   and renders centered in the footer bar area.

async function isFooterAreaDark(background: Buffer, layout: Layout): Promise<boolean> {
  const stats = await sharp(background)
    .extract({
      left: 0,
      top: layout.canvasH - layout.textBarH,
      width: layout.canvasW,
      height: layout.textBarH,
    })
    .stats();
  const r = stats.channels[0].mean;
  const g = stats.channels[1].mean;
  const b = stats.channels[2].mean;
  return (r + g + b) / 3 < SIGNATURE.brightnessThreshold;
}

// ── Signature SVG in-memory cache (read once, never re-read) ──

let _sigCache: string | null = null;

async function loadSignatureSvg(): Promise<string> {
  if (_sigCache) return _sigCache;
  _sigCache = await readFile(
    path.join(process.cwd(), SIGNATURE.svgPath),
    "utf-8",
  );
  return _sigCache;
}

async function renderSignature(
  layout: Layout,
  isDarkBg: boolean,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  // 1. Read SVG file (cached in memory after first read)
  let svgContent: string;
  try {
    svgContent = await loadSignatureSvg();
  } catch {
    const err = new Error(
      "Signature SVG not found — ensure public/signature.svg exists",
    );
    // Invalidate cache so it retries next request (e.g. file was recreated)
    _sigCache = null;
    throw err;
  }

  // 2. Adapt color to background brightness
  // Clone the cached template because .replace() returns a new string;
  // the cache stays pristine for concurrent requests.
  if (!isDarkBg) {
    const { primary, secondary } = SIGNATURE.darkColors;
    svgContent = svgContent
      .replace(/fill="#ffffff"/g, `fill="${primary}"`)
      .replace(/fill="#999999"/g, `fill="${secondary}"`);
  }

  // 3. Render at fixed height, width auto-scales via aspect ratio
  const { data: buffer, info } = await sharp(Buffer.from(svgContent))
    .resize(null, SIGNATURE.targetHeight)
    .png()
    .toBuffer({ resolveWithObject: true });

  return { buffer, width: info.width, height: info.height };
}

// ── Composite Renderer ────────────────────────────

type FooterLayer = Buffer | { buffer: Buffer; width: number; height: number };

async function renderComposite(
  background: Buffer,
  overlay: Buffer | null,
  photoCard: Buffer,
  typography: FooterLayer,
  layout: Layout,
  theme: ShareTheme,
): Promise<Buffer> {
  const { padX, padTop, cardH, canvasW, textBarH } = layout;

  const layers: sharp.OverlayOptions[] = [];

  if (overlay) {
    layers.push({ input: overlay, top: 0, left: 0 });
  }

  // Photo card (shadow is baked into the SVG via feDropShadow filter)
  layers.push({ input: photoCard, top: padTop, left: padX });

  // Footer: EXIF text (Buffer) or signature (object with dimensions)
  if (Buffer.isBuffer(typography)) {
    layers.push({ input: typography, top: padTop + cardH, left: 0 });
  } else {
    const offX = Math.round((canvasW - typography.width) / 2);
    const offY = Math.round((textBarH - typography.height) / 2);
    layers.push({ input: typography.buffer, top: padTop + cardH + offY, left: offX });
  }

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
 *   Background     → blurred, desaturated from photo (rendered first — signature needs it)
 *   Overlay        → optional tonal unification (not a vignette)
 *   Shadow         → SVG feDropShadow (true Gaussian, baked into photo card)
 *   Photo          → resized + rounded corners, no crop
 *   Typography/Sig → centred single-line EXIF text OR signature SVG on transparent bg
 *   Composite      → assembles all layers bottom-to-top
 *
 * Pass `template: "signature"` to render the signature mark instead of brand + EXIF.
 */
export async function generateShareImage(
  photo: Photo,
  imageBuffer: Buffer,
  theme: ShareTheme = CLASSIC_THEME,
  template: "classic" | "signature" = "classic",
): Promise<ShareResult> {
  // Step 0: measure photo → compute layout
  const meta = await sharp(imageBuffer).metadata();
  const layout = computeLayout(meta.width ?? 1200, meta.height ?? 800, theme);

  // Step 1: background first — signature color depends on footer brightness
  const background = await renderBackground(imageBuffer, layout, theme);

  const isSignature = template === "signature";
  let footerLayer: FooterLayer;

  if (isSignature) {
    const isDark = await isFooterAreaDark(background, layout);
    footerLayer = await renderSignature(layout, isDark);
  } else {
    footerLayer = await renderTypography(layout, photo, theme);
  }

  // Step 2: remaining layers in parallel
  const [overlay, photoCard] = await Promise.all([
    renderOverlay(layout, theme),
    renderPhoto(imageBuffer, layout, theme),
  ]);

  // Step 3: composite bottom-to-top (shadow is baked into photoCard SVG)
  const buffer = await renderComposite(
    background,
    overlay,
    photoCard,
    footerLayer,
    layout,
    theme,
  );

  return { buffer, layout };
}
