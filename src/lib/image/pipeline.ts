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

  // allSettled rather than all: with `all`, the first rejection starts the cleanup
  // while the other upload is still in flight, so its object can land *after* the
  // delete — an orphan nothing in the database references. Waiting for both means
  // cleanup only ever names keys that actually exist.
  const [photoRes, thumbRes] = await Promise.allSettled([
    uploadToR2(photoKey, imageResult.optimized, "image/webp"),
    uploadToR2(thumbKey, imageResult.thumbnail, "image/webp"),
  ]);

  const rollbackLanded = async () => {
    const landed = [
      ...(photoRes.status === "fulfilled" ? [photoKey] : []),
      ...(thumbRes.status === "fulfilled" ? [thumbKey] : []),
    ];
    if (!landed.length) return;
    // Best-effort: a cleanup failure must not replace the original error, or the
    // caller ends up debugging a delete problem instead of the upload one.
    try {
      await deleteFromR2(landed);
    } catch (cleanupError) {
      console.warn("Pipeline: rollback of uploaded keys failed:", cleanupError);
    }
  };

  if (photoRes.status === "rejected") {
    await rollbackLanded();
    throw photoRes.reason;
  }
  if (thumbRes.status === "rejected") {
    await rollbackLanded();
    throw thumbRes.reason;
  }

  return {
    photoUrl: photoRes.value,
    thumbUrl: thumbRes.value,
    blurDataURL,
    width: imageResult.width,
    height: imageResult.height,
    exif,
    location,
    uploadedKeys: [photoKey, thumbKey],
  };
}
