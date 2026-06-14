import { randomUUID } from "crypto";
import { processImage } from "./thumbnail";
import { extractExif, type ExifData } from "./exif";
import { generateBlurDataURL } from "./blurhash";
import { reverseGeocode, type LocationData } from "@/lib/geocode";
import { uploadToR2, deleteFromR2 } from "@/lib/r2";

export interface PipelineResult {
  photoUrl: string;
  thumbUrl: string;
  blurDataURL: string;
  width: number;
  height: number;
  exif: ExifData | null;
  location: LocationData | null;
  uploadedKeys: string[];
}

/**
 * Memory Phase + Upload Phase.
 *
 * 1. Runs image processing, EXIF extraction, and LQIP generation in parallel.
 * 2. Uploads optimized + thumbnail to R2.
 * 3. Returns everything needed for DB insert, plus uploadedKeys for rollback.
 *
 * On R2 upload failure, attempts to clean up any uploaded keys before throwing.
 */
export async function pipeline(buffer: Buffer): Promise<PipelineResult> {
  // ── Step 1: Memory Phase ──────────────────────────
  // Image processing, EXIF extraction, and LQIP generation run in parallel
  const [imageResult, exif, blurDataURL] = await Promise.all([
    processImage(buffer),
    extractExif(buffer),
    generateBlurDataURL(buffer),
  ]);

  // ── Step 1.5: Reverse geocoding ────────────────────
  let location: LocationData | null = null;
  if (exif?.latitude != null && exif?.longitude != null) {
    location = await reverseGeocode(exif.latitude, exif.longitude);
  }

  // ── Step 2: Upload Phase ──────────────────────────
  const uuid = randomUUID();
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const photoKey = `photos/${year}/${month}/${uuid}.webp`;
  const thumbKey = `thumbnails/${year}/${month}/${uuid}.webp`;

  try {
    const [photoUrl, thumbUrl] = await Promise.all([
      uploadToR2(photoKey, imageResult.optimized, "image/webp"),
      uploadToR2(thumbKey, imageResult.thumbnail, "image/webp"),
    ]);

    return {
      photoUrl,
      thumbUrl,
      blurDataURL,
      width: imageResult.width,
      height: imageResult.height,
      exif,
      location,
      uploadedKeys: [photoKey, thumbKey],
    };
  } catch (error) {
    // Attempt cleanup of any keys that may have been written
    // deleteFromR2 is idempotent — safe to call with non-existent keys
    await deleteFromR2([photoKey, thumbKey]);
    throw error;
  }
}
