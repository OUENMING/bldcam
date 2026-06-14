export interface LocationData {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  district: string | null;
  fullAddress: string | null;
  placeFormatted: string | null;
}

// ── Provider types ────────────────────────────────

interface GeocodingProvider {
  name: string;
  reverse(lat: number, lng: number): Promise<LocationData | null>;
}

// ── BigDataCloud ──────────────────────────────────
//
// Free, no API key, global CDN. Commercial provider —
// should be accessible from both China and rest of world.
// https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api

async function bigDataCloud(
  lat: number,
  lng: number,
): Promise<LocationData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const url = new URL(
      "https://api.bigdatacloud.net/data/reverse-geocode-client",
    );
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("localityLanguage", "zh");

    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (!data) return null;

    // Build formatted place name
    const placeFormatted =
      data.city || data.locality || data.principalSubdivision || null;

    return {
      city: data.city || data.locality || null,
      region: data.principalSubdivision || null,
      country: data.countryName || null,
      countryCode: data.countryCode
        ? data.countryCode.toUpperCase()
        : null,
      district: null, // BigDataCloud free tier doesn't include district
      fullAddress: null,
      placeFormatted,
    };
  } catch {
    return null;
  }
}

// ── Nominatim (OpenStreetMap) ─────────────────────
//
// Free, no API key. Excellent global coverage but
// nominatim.openstreetmap.org is blocked in mainland China.
// Used as fallback when BigDataCloud fails.

async function nominatim(
  lat: number,
  lng: number,
): Promise<LocationData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "json");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("zoom", "10");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "zh");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "bldcam/1.0 (personal photography portfolio)",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.address) return null;

    const a = data.address;

    const placeFormatted =
      a.city || a.town || a.village || a.county || a.state || null;

    return {
      city: a.city || a.town || a.village || a.county || a.state || null,
      region: a.state || a.region || null,
      country: a.country || null,
      countryCode: a.country_code ? a.country_code.toUpperCase() : null,
      district: a.suburb || a.district || a.borough || null,
      fullAddress: data.display_name ?? null,
      placeFormatted,
    };
  } catch {
    return null;
  }
}

// ── Orchestrator ──────────────────────────────────

const providers: GeocodingProvider[] = [
  { name: "bigdatacloud", reverse: bigDataCloud },
  { name: "nominatim", reverse: nominatim },
];

/**
 * Reverse-geocode a lat/lng pair into structured location data.
 *
 * Tries providers in sequence: BigDataCloud first (global CDN, works
 * in China), then Nominatim as fallback (blocked in China but better
 * coverage). Each provider has a 5s timeout — total worst case ~10s.
 *
 * Returns null if all providers fail — never blocks the upload.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<LocationData | null> {
  for (const provider of providers) {
    const result = await provider.reverse(lat, lng);
    if (result) return result;
  }

  return null;
}
