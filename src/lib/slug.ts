import { randomUUID } from "crypto";

/**
 * Generate a URL-safe ASCII slug from a photo title.
 *
 * Keeps ASCII alphanumerics, hyphens and underscores — everything else (Chinese,
 * emoji, symbols) collapses to a hyphen. Falls back to "photo" if nothing remains.
 * Appends an 8-character hex suffix for uniqueness.
 *
 * Examples:
 *   "Liffey River"  → "liffey-river-a1b2c3d4"
 *   "广州塔夜色"     → "photo-b3c4d5e6"
 *   "IMG_5391"      → "img_5391-d5e6f7a8"
 */
export function generateSlug(title: string): string {
  // 1) Normalize: trim, lowercase ASCII. Underscores survive this and step 2.
  let slug = title
    .trim()
    .replace(/[A-Z]/g, (c) => c.toLowerCase());

  // 2) Everything else becomes a hyphen
  slug = slug.replace(/[^a-z0-9_-]+/g, "-");

  // 3) Collapse consecutive hyphens, trim edges
  slug = slug.replace(/-{2,}/g, "-").replace(/^-|-$/g, "");

  // 4) Fallback for titles with zero ASCII content
  if (!slug) slug = "photo";

  // 5) 8 hex characters ≈ 4.3e9 values. Collisions only start to matter near the
  //    birthday bound (~77k slugs), which this gallery is nowhere near.
  const suffix = randomUUID().slice(0, 8);
  return `${slug}-${suffix}`;
}
