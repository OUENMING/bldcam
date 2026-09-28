/**
 * Renders `src/app/opengraph-image.png` — the card shown when a link to the site
 * is shared.
 *
 * Run with: node scripts/make-og-image.mjs
 *
 * The output is committed rather than generated at request time. That keeps the
 * fonts a build-time concern only: `next/og` would need a font file bundled into
 * the repo, and the site's real faces come from `next/font/google` and are not
 * available to a renderer. Rendering once here also means the card cannot fail in
 * production.
 *
 * Latin text uses Georgia (the site's heading face is Instrument Serif, which is
 * not installed locally — a serif keeps the register even though the face differs).
 * The Chinese line names Noto Sans SC explicitly; leaving it to a generic fallback
 * is how CJK text ends up as tofu.
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
