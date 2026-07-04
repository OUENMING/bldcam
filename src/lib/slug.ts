import { randomUUID } from "crypto";

/**
 * Generate a URL-safe ASCII slug from a photo title.
 *
 * Only keeps ASCII alphanumerics and hyphens — all other characters
 * (Chinese, emoji, symbols) are stripped. Falls back to "photo" if
 * nothing remains. Appends a 4-char UUID suffix for uniqueness.
 *
 * Examples:
 *   "Liffey River"   → "liffey-river-a1b2c3d4"
 *   "广州塔夜色"      → "photo-b3c4d5e6"
 *   IMG_5391         → "img-5391-d5e6f7g8"
 */
export function generateSlug(title: string): string {
  // 1) Normalize: trim, lowercase ASCII
  let slug = title
    .trim()
    .replace(/[A-Z]/g, (c) => c.toLowerCase());

  // 2) Strip everything except ASCII alphanumerics, hyphens, underscores
  slug = slug.replace(/[^a-z0-9_-]+/g, "-");

  // 3) Collapse consecutive hyphens, trim edges
  slug = slug.replace(/-{2,}/g, "-").replace(/^-|-$/g, "");

  // 4) Fallback for titles with zero ASCII content
  if (!slug) slug = "photo";

  // 5) Append 8-char random suffix for uniqueness (4B+ combos)
  const suffix = randomUUID().slice(0, 8);
  return `${slug}-${suffix}`;
}
