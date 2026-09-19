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
  // One sharp instance, cloned for each output: clone() shares the decoded source
  // rather than re-reading the buffer.
  const image = sharp(buffer);
  // `autoOrient` gives the dimensions the photo has once its EXIF orientation is
  // applied — the same numbers `.rotate()` below will produce. Computing the swap
  // by hand (orientation >= 5 → width/height reversed) re-derived a rule sharp
  // already owns, and only happened to agree with the output.
  const oriented = (await image.metadata()).autoOrient;
  // A decodable image always reports both. Zero means sharp could not identify the
  // format, and storing 0×0 breaks every layout that divides by the ratio — failing
  // here is louder and the caller already rolls back its uploads.
  if (!oriented.width || !oriented.height) {
    throw new Error("Could not read the image's dimensions");
  }
  const { width, height } = oriented;

  const [optimized, thumbnail] = await Promise.all([
    // `.rotate()` with no argument bakes in the EXIF orientation. Without it the
    // pixels keep their stored orientation and the tag is dropped on encode
    // (verified: the output webp reports orientation undefined), so a portrait
    // phone photo renders sideways with nothing left for the browser to correct.
    image
      .clone()
      .rotate()
      .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer(),

    // Thumbnail: 800px, inside (preserves aspect ratio), webp.
    // `withoutEnlargement` matters here as much as above: without it a 400px photo
    // was upscaled to 800 and came back softer *and* larger than the original.
    image
      .clone()
      .rotate()
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer(),
  ]);

  return { optimized, thumbnail, width, height };
}
