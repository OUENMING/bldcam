import exifr from "exifr";

export interface ExifData {
  make: string | null;
  model: string | null;
  lensModel: string | null;
  focalLength: number | null;
  focalLength35mm: number | null;
  fNumber: number | null;
  iso: number | null;
  exposureTime: number | null;
  exposureCompensation: number | null;
  dateTimeOriginal: Date | null;
  gpsAltitude: number | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Extract EXIF data from an image buffer.
 * Never throws — returns null on any failure.
 */
export async function extractExif(buffer: Buffer): Promise<ExifData | null> {
  try {
    // Parse all GPS tags explicitly — latitude/longitude are computed
    // from GPSLatitude/GPSLongitude/GPSLatitudeRef/GPSLongitudeRef
    const data = await exifr.parse(buffer, {
      gps: true,
      pick: [
        "Make",
        "Model",
        "LensModel",
        "FocalLength",
        "FocalLengthIn35mmFormat",
        "FNumber",
        "ISO",
        "ExposureTime",
        "ExposureCompensation",
        "DateTimeOriginal",
        "GPSAltitude",
        "GPSLatitude",
        "GPSLongitude",
        "GPSLatitudeRef",
        "GPSLongitudeRef",
      ],
    });

    if (!data) return null;

    // Decided per coordinate rather than as an all-or-nothing pair. exifr may
    // compute one of the two, and requiring both made a perfectly good value fall
    // back to the raw tags (or to null when those are absent) for no reason.
    const coord = (computed: unknown, raw: unknown, ref: string): number | null => {
      if (typeof computed === "number") return computed;
      if (Array.isArray(raw)) return dmsToDecimal(raw as number[], ref);
      return null;
    };

    const latitude = coord(data.latitude, data.GPSLatitude, data.GPSLatitudeRef ?? "N");
    const longitude = coord(data.longitude, data.GPSLongitude, data.GPSLongitudeRef ?? "E");

    return {
      make: data.Make ?? null,
      model: data.Model ?? null,
      lensModel: data.LensModel ?? null,
      focalLength: data.FocalLength ?? null,
      focalLength35mm: data.FocalLengthIn35mmFormat ?? null,
      fNumber: data.FNumber ?? null,
      iso: data.ISO ?? null,
      exposureTime: data.ExposureTime ?? null,
      exposureCompensation: data.ExposureCompensation ?? null,
      dateTimeOriginal: toValidDate(data.DateTimeOriginal),
      gpsAltitude: data.GPSAltitude ?? null,
      latitude,
      longitude,
    };
  } catch {
    return null;
  }
}

/**
 * EXIF dates arrive in several shapes, and an unparseable one yields an Invalid
 * Date — which renders as the literal "Invalid Date" on the page and sorts
 * unpredictably in the map and gallery queries.
 */
function toValidDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Convert EXIF DMS array to decimal degrees.
 * DMS format: [degrees, minutes, seconds] e.g. [53, 20, 34.5]
 *
 * Returns null when the input cannot be converted. It used to return 0, which is
 * a real coordinate — a parse failure came out as a valid-looking (0, 0) and put
 * the photo in the Gulf of Guinea.
 */
function dmsToDecimal(
  dms: number[],
  ref: string,
): number | null {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  if (!dms.every((n) => Number.isFinite(n))) return null;
  const decimal = dms[0] + dms[1] / 60 + dms[2] / 3600;
  return ref === "S" || ref === "W" ? -decimal : decimal;
}
