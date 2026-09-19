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

// Read from env per call rather than at module load. As module-level constants these
// froze whatever was set at import time, so a test or an invocation that injects env
// later silently kept the defaults.
function r2Bucket(): string {
  return process.env.R2_BUCKET || "camlife";
}

function r2PublicUrl(): string {
  return process.env.R2_PUBLIC_URL || "";
}

/**
 * Public URL for a stored object.
 * No CDN abstraction — just base URL + key.
 */
export function getPublicUrl(key: string): string {
  return `${r2PublicUrl()}/${key}`;
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
  try {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: r2Bucket(),
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch (error) {
    // The SDK's message says nothing about which object failed, and in a 200-file
    // pipeline "AccessDenied" alone is not actionable. `cause` keeps the original.
    throw new Error(`R2 upload failed for ${key} (${contentType})`, { cause: error });
  }
  return getPublicUrl(key);
}

/**
 * Batch-delete objects from R2.
 * Accepts an array of keys. Empty array is a no-op.
 */
const DELETE_BATCH_SIZE = 1000;
export async function deleteFromR2(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  // S3 rejects a DeleteObjects call carrying more than 1000 keys.
  for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
    const batch = keys.slice(i, i + DELETE_BATCH_SIZE);
    // Quiet:false on purpose. With Quiet on, the only sign a key survived is the
    // Errors array — which nothing read, so a failed delete looked exactly like a
    // successful one and objects stayed in the bucket.
    const res = await getR2Client().send(
      new DeleteObjectsCommand({
        Bucket: r2Bucket(),
        Delete: { Objects: batch.map((key) => ({ Key: key })), Quiet: false },
      }),
    );
    for (const err of res.Errors ?? []) {
      console.warn(`deleteFromR2: ${err.Key} not deleted — ${err.Code ?? ""} ${err.Message ?? ""}`);
    }
  }
}

/**
 * Deterministic R2 key for share images (template-aware).
 */
export function getShareKeyV2(photoId: string, template: string = "classic"): string {
  return `share/${photoId}/${template}-v12.png`;
}

/**
 * Extract the R2 object key from a public URL.
 *
 * Supports both old (pub-xxx.r2.dev) and new (cdn.bldcam.page) URL formats.
 * e.g. "https://pub-xxx.r2.dev/photos/2026/06/uuid.webp"
 *   → "photos/2026/06/uuid.webp"
 */
export function extractKeyFromUrl(url: string): string | null {
  // `r2PublicUrl()` defaults to "" and every string starts with "" — without this
  // check the whole URL (protocol and host included) was returned as the key.
  const base = r2PublicUrl();
  if (base && url.startsWith(base)) {
    return stripLeadingSlash(url.slice(base.length));
  }
  // R2's default public host, e.g. https://pub-xxx.r2.dev/photos/2026/06/uuid.webp
  const m = url.match(/^https:\/\/[a-zA-Z0-9-]+\.r2\.dev/);
  if (!m) return null;
  return stripLeadingSlash(url.slice(m[0].length));
}

function stripLeadingSlash(s: string): string {
  return s.startsWith("/") ? s.slice(1) : s;
}
