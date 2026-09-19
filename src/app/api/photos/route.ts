import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromR2, extractKeyFromUrl, getShareKeyV2 } from "@/lib/r2";
import { pipeline } from "@/lib/image/pipeline";
import { generateSlug } from "@/lib/slug";

// ── Auth helper ──────────────────────────────────────
async function guard() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// ═══════════════════════════════════════════════════════
// GET — paginated photo list (public, for infinite scroll)
//
//   ?limit=20          — page size (default 20, max 50)
//   ?cursor=<cuid>     — resume after this photo id
//   ?city=<name>       — optional city filter
//
//   Returns { photos: Photo[], nextCursor: string | null }
// ═══════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  // NOTE: This is a PUBLIC endpoint — no auth guard.
  // The frontend gallery uses it for infinite scroll.

  const { searchParams } = new URL(request.url);
  // Clamp both ends. `Math.min` alone let `?limit=-5` through, and Prisma reads a
  // negative `take` as backwards pagination — the gallery came back in reverse. A
  // fractional value (`?limit=2.5`) throws instead.
  const rawLimit = Number(searchParams.get("limit"));
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 20;
  const cursor = searchParams.get("cursor") || undefined;
  const city = searchParams.get("city") || undefined;
  const category = searchParams.get("category") || undefined;

  const where =
    city ? { city }
    : category ? { category }
    : {};

  // A cursor that no longer resolves is not an error: Prisma returns zero rows, and
  // `photos.length === limit` below is then false, so nextCursor comes back null and
  // the client stops cleanly. (Verified against this schema — it does not throw.)
  const photos = await prisma.photo.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    // Cursor pagination: skip the cursor record itself
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  // If we got a full page, the last photo's id becomes the next cursor.
  // Null signals "no more photos".
  const nextCursor =
    photos.length === limit ? photos[photos.length - 1].id : null;

  return NextResponse.json({ photos, nextCursor });
}

// ═══════════════════════════════════════════════════════
// POST — upload a single photo
// ═══════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  const err = await guard();
  if (err) return err;

  let uploadedKeys: string[] = [];

  try {
    const formData = await request.formData();

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing or invalid file" },
        { status: 400 },
      );
    }

    // A multipart field is a File when the same name repeats or the request is
    // hand-built, and `(x as string).trim()` on one throws into the 500 handler.
    const titleField = formData.get("title");
    const title = typeof titleField === "string" ? titleField.trim() : "";
    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    }

    const description = (formData.get("description") as string)?.trim() || "";
    const category = (formData.get("category") as string)?.trim() || null;

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await pipeline(buffer);
    uploadedKeys = result.uploadedKeys;

    const exif = result.exif;
    const loc = result.location;

    const photo = await prisma.photo.create({
      data: {
        url: result.photoUrl,
        thumbnailUrl: result.thumbUrl,
        blurDataUrl: result.blurDataURL,
        fileSize: file.size,
        width: result.width,
        height: result.height,
        title,
        description,
        category,
        slug: generateSlug(title),

        // EXIF
        make: exif?.make ?? null,
        model: exif?.model ?? null,
        lensModel: exif?.lensModel ?? null,
        focalLength: exif?.focalLength ?? null,
        focalLength35mm: exif?.focalLength35mm ?? null,
        fNumber: exif?.fNumber ?? null,
        iso: exif?.iso ?? null,
        exposureTime: exif?.exposureTime ?? null,
        exposureCompensation: exif?.exposureCompensation ?? null,
        dateTimeOriginal: exif?.dateTimeOriginal ?? null,
        gpsAltitude: exif?.gpsAltitude ?? null,
        latitude: exif?.latitude ?? null,
        longitude: exif?.longitude ?? null,

        // Location
        city: loc?.city ?? null,
        region: loc?.region ?? null,
        country: loc?.country ?? null,
        countryCode: loc?.countryCode ?? null,
        district: loc?.district ?? null,
        fullAddress: loc?.fullAddress ?? null,
        placeFormatted: loc?.placeFormatted ?? null,
      },
    });

    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    if (uploadedKeys.length > 0) {
      await deleteFromR2(uploadedKeys);
    }

    console.error("Upload failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════════
// PATCH — update photo title / description
// ═══════════════════════════════════════════════════════
export async function PATCH(request: NextRequest) {
  const err = await guard();
  if (err) return err;

  try {
    const body = await request.json();
    const { id, title, description } = body as {
      id?: string;
      title?: string;
      description?: string;
    };

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const data: Record<string, string> = {};
    // `typeof` rather than `!== undefined`: a JSON body carrying a number or object
    // reaches `.trim()` and throws. A non-string is simply not a field to update, so
    // the request falls through to "No fields to update" instead of a 500.
    if (typeof title === "string") {
      const trimmed = title.trim();
      data.title = trimmed;
      data.slug = generateSlug(trimmed);
    }
    if (typeof description === "string") data.description = description.trim();

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    // Verify photo exists
    const existing = await prisma.photo.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const photo = await prisma.photo.update({ where: { id }, data });
    return NextResponse.json(photo);
  } catch (error) {
    console.error("PATCH failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════════
// DELETE — remove photo (R2 + DB)
// ═══════════════════════════════════════════════════════
export async function DELETE(request: NextRequest) {
  const err = await guard();
  if (err) return err;

  try {
    const { id } = (await request.json()) as { id?: string };

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const photo = await prisma.photo.findUnique({ where: { id } });
    if (!photo) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ── Collect R2 keys ─────────────────────────────
    const keys: string[] = [];
    const photoKey = extractKeyFromUrl(photo.url);
    if (photoKey) keys.push(photoKey);

    if (photo.thumbnailUrl) {
      const thumbKey = extractKeyFromUrl(photo.thumbnailUrl);
      if (thumbKey) keys.push(thumbKey);
    }

    // Clean up cached share images (both templates)
    keys.push(getShareKeyV2(id, "classic"));
    keys.push(getShareKeyV2(id, "signature"));

    // ── Delete the DB record FIRST ──────────────────
    // The record is the source of truth, so removing it first means a later R2
    // failure leaves an unreferenced object — harmless. The old order did the
    // reverse, and a failed `prisma.photo.delete` left a row pointing at an object
    // that was already gone: a permanently broken image that could not self-heal.
    await prisma.photo.delete({ where: { id } });

    // ── Then clean up R2 (best-effort) ──────────────
    if (keys.length > 0) {
      try {
        await deleteFromR2(keys);
      } catch (r2Err) {
        console.error("R2 cleanup failed after DB delete (objects orphaned):", r2Err);
      }
    }

    return NextResponse.json({ success: true, deletedKeys: keys.length });
  } catch (error) {
    console.error("DELETE failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
