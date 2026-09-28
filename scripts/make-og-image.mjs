/**
 * Renders `src/app/opengraph-image.png` — the card shown when a link to the site
 * is shared.
 *
 * Run with: node scripts/make-og-image.mjs
 *
 * **Must be run on this Mac.** sharp renders SVG text through the system font
 * stack and cannot carry a font of its own, so a machine without the CJK faces
 * below — a Linux CI box, a slim container — would rasterise the Chinese line as
 * tofu. The output is committed, so that failure would be baked into the repo
 * silently: the script would exit 0 and write a broken image. There is no runtime
 * dependency on any of this; nothing outside this script reads a font.
 *
 * The output is committed rather than generated per request because `next/og`
 * would need a font file bundled into the repo, and the site's real faces come
 * from `next/font/google` and are not available to a renderer.
 *
 * Latin text uses Georgia (the site's heading face is Instrument Serif, which is
 * not installed locally — a serif keeps the register even though the face differs).
 * The Chinese line names Noto Sans SC and PingFang SC explicitly; leaving it to a
 * generic fallback is how CJK text ends up as tofu.
 *
 * The domain printed on the card is display text, not a URL, so it is a copy of
 * `SITE_URL` rather than a use of it — change both if the domain changes.
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const out = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src/app/opengraph-image.png",
);

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="16%" r="72%">
      <stop offset="0%" stop-color="#c8a87c" stop-opacity="0.20"/>
      <stop offset="55%" stop-color="#c8a87c" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#0c0a08" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="#0c0a08"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <text x="600" y="296" text-anchor="middle" font-family="Georgia, serif"
        font-size="128" letter-spacing="8">
    <tspan font-weight="700" fill="#f0e6d6">BLD</tspan><tspan font-style="italic" fill="#c8a87c">cam</tspan>
  </text>

  <text x="600" y="372" text-anchor="middle"
        font-family="Noto Sans SC, PingFang SC, sans-serif"
        font-size="32" fill="#a89b88" letter-spacing="2">星空与旅行摄影作品集</text>

  <line x1="536" y1="424" x2="664" y2="424" stroke="#c8a87c" stroke-opacity="0.4" stroke-width="2"/>

  <text x="600" y="486" text-anchor="middle" font-family="Georgia, serif"
        font-size="24" fill="#5c5248" letter-spacing="3">bldcam.page</text>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);
console.log("wrote", out);
