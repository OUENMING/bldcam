import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

function createR2Client(): S3Client {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error(
      "R2 credentials missing. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT.",
    );
  }

  return new S3Client({
    region: process.env.R2_REGION || "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

let _r2Client: S3Client | null = null;
function getR2Client(): S3Client {
  if (!_r2Client) _r2Client = createR2Client();
  return _r2Client;
}

export const R2_BUCKET = process.env.R2_BUCKET || "camlife";
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

/**
 * Public URL for a stored object.
 * No CDN abstraction — just base URL + key.
 */
export function getPublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Upload a single object to R2.
 * Returns the public URL.
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return getPublicUrl(key);
}

/**
 * Batch-delete objects from R2.
 * Accepts an array of keys. Empty array is a no-op.
 */
export async function deleteFromR2(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  await getR2Client().send(
    new DeleteObjectsCommand({
      Bucket: R2_BUCKET,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
        Quiet: true,
      },
    }),
  );
}

/**
 * Extract the R2 object key from a public URL.
 *
 * Supports both old (pub-xxx.r2.dev) and new (cdn.bldcam.page) URL formats.
 * e.g. "https://pub-xxx.r2.dev/photos/2026/06/uuid.webp"
 *   → "photos/2026/06/uuid.webp"
 */
/**
 * Deterministic R2 key and URL for share images.
 */
export function getShareKey(photoId: string): string {
  return `share/${photoId}/classic.png`;
}

export function getShareUrl(photoId: string): string {
  return `${R2_PUBLIC_URL}/${getShareKey(photoId)}`;
}

export function extractKeyFromUrl(url: string): string | null {
  // Try current CDN domain first, then R2's default public host
  const parts =
    url.startsWith(R2_PUBLIC_URL)
      ? [R2_PUBLIC_URL]
      : url.match(/^https:\/\/[a-zA-Z0-9-]+\.r2\.dev/)?.[0]
        ? [url.match(/^https:\/\/[a-zA-Z0-9-]+\.r2\.dev/)![0]]
        : null;

  if (!parts) return null;
  const key = url.slice(parts[0].length);
  return key.startsWith("/") ? key.slice(1) : key;
}
