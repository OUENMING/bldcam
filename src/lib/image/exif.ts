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

    // Prefer exifr's computed decimal coordinates; fall back to
    // manual conversion from GPS raw tags
    let latitude: number | null = null;
    let longitude: number | null = null;

    if (typeof data.latitude === "number" && typeof data.longitude === "number") {
      latitude = data.latitude;
      longitude = data.longitude;
    } else if (data.GPSLatitude && data.GPSLongitude) {
      latitude = dmsToDecimal(
        data.GPSLatitude,
        data.GPSLatitudeRef ?? "N",
      );
      longitude = dmsToDecimal(
        data.GPSLongitude,
        data.GPSLongitudeRef ?? "E",
      );
    }

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
      dateTimeOriginal: data.DateTimeOriginal
        ? new Date(data.DateTimeOriginal)
        : null,
      gpsAltitude: data.GPSAltitude ?? null,
      latitude,
      longitude,
    };
  } catch {
    return null;
  }
}

/**
 * Convert EXIF DMS array to decimal degrees.
 * DMS format: [degrees, minutes, seconds] e.g. [53, 20, 34.5]
 */
function dmsToDecimal(
  dms: number[],
  ref: string,
): number {
  if (!Array.isArray(dms) || dms.length < 3) return 0;
  const decimal = dms[0] + dms[1] / 60 + dms[2] / 3600;
  return ref === "S" || ref === "W" ? -decimal : decimal;
}
