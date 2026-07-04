/**
 * Format exposure time to human-readable string.
 * 0.008 → "1/125s", 1 → "1s", 30 → "30s"
 */
export function formatExposureTime(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "";
  if (seconds < 1) {
    const denominator = Math.round(1 / seconds);
    return `1/${denominator}s`;
  }
  if (seconds === 1) return "1s";
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
  const value = Math.abs(snapped - raw) < 0.15 ? snapped : Number(raw.toFixed(1));
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
  if (photo.fNumber != null) parts.push(formatAperture(photo.fNumber));
  if (photo.iso != null) parts.push(`ISO ${photo.iso}`);
  if (photo.exposureTime != null) parts.push(formatExposureTime(photo.exposureTime));
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
