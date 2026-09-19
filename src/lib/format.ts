/**
 * Format exposure time to human-readable string.
 * 0.008 → "1/125s", 1 → "1s", 30 → "30s"
 */
export function formatExposureTime(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "";
  if (seconds < 1) {
    const denominator = Math.round(1 / seconds);
    // Rounding collapses 0.7s to a denominator of 1, which would print "1/1s" —
    // reading as a full second when it is not. Show the decimal instead.
    if (denominator > 1) return `1/${denominator}s`;
    return `${Number(seconds.toFixed(1))}s`;
  }
  return `${seconds}s`;
}

/**
 * Format a Date to "YYYY.MM.DD" style.
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

/**
 * Standard f-stop sequence for snapping raw aperture values.
 */
const F_STOPS = [
  1.0, 1.1, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.5, 2.8,
  3.2, 3.5, 4.0, 4.5, 5.0, 5.6, 6.3, 7.1, 8.0, 9.0,
  10, 11, 13, 14, 16, 18, 20, 22, 25, 29, 32,
];

/**
 * Snap a raw f-number to the nearest standard f-stop and format it.
 * Uses the typographic florin sign (U+0192) for the f character.
 * 1.78 → "ƒ/1.8", 1.4 → "ƒ/1.4", 2.0 → "ƒ/2"
 */
export function formatAperture(raw: number | null): string {
  if (raw == null || raw <= 0) return "";
  const snapped = F_STOPS.reduce((best, stop) =>
    Math.abs(stop - raw) < Math.abs(best - raw) ? stop : best,
  );
  // Snap only inside the table's own range. Its widest stop is f/1.0, so anything
  // faster rounds *up* to it and destroys the one number worth knowing about such a
  // lens — f/0.95 came out as "ƒ/1". Outside the range, report what the camera said,
  // with a second decimal because 0.95 rounded to one decimal is 1.0 again.
  const inRange = raw >= F_STOPS[0] && raw <= F_STOPS[F_STOPS.length - 1];
  const value =
    inRange && Math.abs(snapped - raw) < 0.15
      ? snapped
      : Number(raw.toFixed(raw < 1 ? 2 : 1));
  return `ƒ/${value}`;
}

/** Minimal interface for EXIF-summary-capable objects. */
export interface ExifPhotoLike {
  focalLength35mm?: number | null;
  focalLength?: number | null;
  fNumber?: number | null;
  iso?: number | null;
  exposureTime?: number | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
}

/**
 * Format a one-line EXIF summary: focal length, aperture, ISO, shutter.
 * Uses formatAperture and formatExposureTime internally.
 */
export function formatExifLine(photo: ExifPhotoLike): string {
  const parts: string[] = [];
  if (photo.focalLength35mm != null) {
    parts.push(`${Math.round(photo.focalLength35mm)}mm`);
  } else if (photo.focalLength != null) {
    parts.push(`${Math.round(photo.focalLength)}mm`);
  }
  // Each formatter returns "" for a value it cannot render (a zero aperture, a
  // non-positive shutter). Pushing that empty string left a stray " · " on the end.
  const aperture = photo.fNumber != null ? formatAperture(photo.fNumber) : "";
  if (aperture) parts.push(aperture);
  if (photo.iso != null) parts.push(`ISO ${photo.iso}`);
  const shutter =
    photo.exposureTime != null ? formatExposureTime(photo.exposureTime) : "";
  if (shutter) parts.push(shutter);
  return parts.join(" · ");
}

/**
 * Format city / region / country into a location string.
 * Returns empty string when all three are missing.
 */
export function formatLocation(photo: ExifPhotoLike): string {
  return [photo.city, photo.region, photo.country].filter(Boolean).join(" · ");
}

/**
 * Format GPS coordinate to DMS-like string.
 */
export function formatGps(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return "";
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${latDir}  ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

// ═══════════════════════════════════════════════════════════
// CAMERA BRAND / MODEL — display cleanup
//   Moved here from share.ts so the detail page + lightbox reuse
//   the same friendly names the share card already uses.
//   Pure string functions — no sharp/fs dependency (bundle-safe).
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

/** Pretty-print a camera make ("NIKON CORPORATION" → "Nikon"). */
export function brandDisplayName(make: string | null): string | null {
  if (!make) return null;
  const trimmed = make.trim();
  return BRAND_DISPLAY[trimmed] ?? trimmed;
}

/** Strip the brand prefix from a model string. */
export function cleanModel(
  model: string | null,
  make: string | null,
  displayBrand: string | null,
): string | null {
  if (!model) return null;
  let m = model.trim();
  if (make) {
    const raw = make.trim();
    // Try stripping the full make string first (e.g. "NIKON CORPORATION")
    m = m.replace(new RegExp(`^${escRegex(raw)}\\s*`, "i"), "").trim();
    // Then try the first word of make (e.g. "NIKON")
    const firstWord = raw.split(/\s+/)[0];
    if (firstWord) {
      m = m.replace(new RegExp(`^${escRegex(firstWord)}\\s*`, "i"), "").trim();
    }
    // Then try the display brand name (e.g. "Nikon")
    if (displayBrand) {
      m = m.replace(new RegExp(`^${escRegex(displayBrand)}\\s*`, "i"), "").trim();
    }
  }
  return m || null;
}

/** Escape string for use in RegExp constructor. */
export function escRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Underscore-encoded Roman numerals in Nikon models ("Z 6_2" → "Z 6 II")
const ROMAN: Record<string, string> = {
  "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V",
  "6": "VI", "7": "VII", "8": "VIII", "9": "IX", "10": "X",
};

// Phone/consumer lines whose model already names the product —
// prepending the make ("Apple iPhone 14") is redundant noise.
const SELF_DESCRIBING_MODELS = [
  "iPhone", "iPad", "Pixel", "Galaxy", "Xiaomi", "Redmi", "Poco", "Huawei", "Honor",
];

/**
 * Format a camera make+model for the "相机" line.
 * "NIKON CORPORATION" + "NIKON Z 6_2" → "Nikon Z 6 II"
 * "Apple" + "iPhone 14" → "iPhone 14"
 */
export function formatCamera(
  make: string | null,
  model: string | null,
): string {
  const brand = brandDisplayName(make);
  let m = cleanModel(model, make, brand) ?? "";
  // `_(\d+)`, not `_(\d)`: a single-digit capture ate only the "1" of Nikon's
  // "_10" and left the "0" as literal text, rendering "Z 6 I0". It also made the
  // "10": "X" entry in ROMAN unreachable.
  m = m.replace(/_(\d+)/g, (_all, d: string) => ` ${ROMAN[d] ?? d}`);
  if (!brand) return m;
  if (SELF_DESCRIBING_MODELS.some((p) => m.startsWith(p))) return m;
  return [brand, m].filter(Boolean).join(" ");
}
