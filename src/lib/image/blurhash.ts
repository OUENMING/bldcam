import sharp from "sharp";

/**
 * Generate a tiny blurred base64 placeholder (LQIP).
 * Resizes to ~16px wide, outputs as base64 PNG data URL.
 * No blurhash npm package — pure sharp pipeline.
 */
export async function generateBlurDataURL(buffer: Buffer): Promise<string> {
  const tiny = await sharp(buffer)
    .resize(16) // width: 16px, height auto (maintains aspect ratio)
    .png({ quality: 1, compressionLevel: 9 })
    .toBuffer();

  return `data:image/png;base64,${tiny.toString("base64")}`;
}
