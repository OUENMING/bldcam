/**
 * Format exposure time to human-readable string.
 * 0.008 → "1/125s", 1 → "1s", 30 → "30s"
 */
export function formatExposureTime(seconds: number): string {
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
 * Format GPS coordinate to DMS-like string.
 */
export function formatGps(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${latDir}  ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}
