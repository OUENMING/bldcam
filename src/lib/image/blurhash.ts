import sharp from "sharp";

/**
 * Generate a tiny blurred base64 placeholder (LQIP).
 * Resizes to ~16px wide, outputs as base64 PNG data URL.
 * No blurhash npm package — pure sharp pipeline.
 */
export async function generateBlurDataURL(buffer: Buffer): Promise<string> {
  const tiny = await sharp(buffer)
    // Bounded on both axes. `resize(16)` alone fixes only the width, so a 1×20000
    // panorama came back 16×320000 and its PNG dwarfed the original.
    .resize(16, 16, { fit: "inside" })
    // Plain `.png()`: the `quality` this used to pass only takes effect alongside
    // `palette: true` (it means "fewest colours", not "compression level"), and at
    // 16px the extra zlib effort of level 9 buys nothing.
    .png()
    .toBuffer();

  return `data:image/png;base64,${tiny.toString("base64")}`;
}
