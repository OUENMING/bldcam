/**
 * Passthrough image loader — Cloudflare CDN images are already
 * optimized (WebP by Sharp), so Next.js re-optimization is redundant.
 *
 * Returns the original URL unchanged. Width and quality params are
 * stripped since R2 serves static files (no on-the-fly resizing).
 */
export default function imageLoader({
  src,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  return src;
}
