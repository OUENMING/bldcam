import sharp from "sharp";

export interface ProcessedImage {
  optimized: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
}

/**
 * Generate optimized + thumbnail versions from an image buffer.
 * Always returns the original image's real dimensions.
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const [optimized, thumbnail] = await Promise.all([
    // Optimized: max 2000px, fit inside (no cropping), webp
    image
      .clone()
      .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer(),

    // Thumbnail: 800px, inside (preserves aspect ratio), webp
    sharp(buffer)
      .resize(800, 800, { fit: "inside" })
      .webp({ quality: 75 })
      .toBuffer(),
  ]);

  return { optimized, thumbnail, width, height };
}
