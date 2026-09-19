"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Map, { Marker, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { formatAperture, formatLocation } from "@/lib/format";
import { cityFilterHref } from "@/lib/utils";
import type { Photo } from "@prisma/client";

// ── Types ────────────────────────────────────────

type MapPhoto = Pick<
  Photo,
  | "id" | "title" | "thumbnailUrl" | "url"
  | "latitude" | "longitude"
  | "city" | "region" | "country"
  | "fNumber" | "focalLength35mm" | "iso" | "exposureTime"
  | "dateTimeOriginal" | "width" | "height"
>;

interface PhotoMapProps {
  photos: MapPhoto[];
}

// ── Popup card ───────────────────────────────────

function PhotoPopup({
  photo,
  onClose,
}: {
  photo: MapPhoto;
  onClose: () => void;
}) {
  const router = useRouter();

  const location = formatLocation(photo);

  const coords = photo.latitude && photo.longitude
    ? `${photo.latitude.toFixed(4)}°, ${photo.longitude.toFixed(4)}°`
    : null;

  const exif = [
    photo.focalLength35mm && `${photo.focalLength35mm}mm`,
    photo.fNumber && formatAperture(photo.fNumber),
    photo.iso && `ISO ${photo.iso}`,
  ]
    .filter(Boolean)
    .join(" · ");

  // Narrowed once, so the action below needs no non-null assertion and no separate
  // `hasCity` flag that could drift out of step with it.
  const city = photo.city;

  return (
    <div className="w-64 rounded-xl border border-amber-600/30 bg-background p-3 shadow-[0_0_25px_-5px_rgba(217,119,6,0.15)]">
      {/* Thumbnail */}
      {photo.thumbnailUrl && (
        <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-md bg-muted">
          <Image
            src={photo.thumbnailUrl}
            alt={photo.title}
            fill
            className="object-cover"
            sizes="240px"
          />
        </div>
      )}

      {/* Title */}
      <h3 className="font-semibold text-foreground text-sm">{photo.title}</h3>

      {/* Location or coords */}
      {location && (
        <p className="mt-0.5 truncate text-muted-foreground text-xs">{location}</p>
      )}
      {!location && coords && (
        <p className="mt-0.5 truncate text-muted-foreground text-xs">{coords}</p>
      )}

      {/* EXIF */}
      {exif && <p className="mt-1 text-muted-foreground text-xs">{exif}</p>}

      {/* Action: go to city page */}
      {city && (
        <button
          type="button"
          onClick={() => {
            // `city`, not `photo.city!` — the assertion hid the coupling that a
            // separate flag used to carry.
            router.push(cityFilterHref(city));
            onClose();
          }}
          className="mt-2 w-full rounded-lg border border-amber-900/50 bg-amber-950/30 py-1.5 text-amber-500 text-xs transition-colors hover:bg-amber-900/50"
        >
          查看 {photo.city} 的全部照片 →
        </button>
      )}
    </div>
  );
}

// ── Glow Marker ──────────────────────────────────

function DotMarker() {
  return (
    <div className="h-3 w-3 cursor-pointer rounded-full border-2 border-amber-500 bg-white shadow-[0_0_8px_rgba(245,158,11,0.6)] transition-transform hover:scale-125" />
  );
}

// ── Map ──────────────────────────────────────────

export function PhotoMap({ photos }: PhotoMapProps) {
  const [hovered, setHovered] = useState<MapPhoto | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  // Every path that opens or closes the popup goes through one of these two, so a
  // pending close scheduled by a mouseleave can never fire against a popup that was
  // opened after it. That race was the "popup flashes and disappears" case: leaving
  // the popup and clicking a marker within 250ms let the old timer null the new one.
  const closePopup = useCallback(() => {
    clearTimer();
    setHovered(null);
  }, [clearTimer]);

  const handleMouseEnter = useCallback((photo: MapPhoto) => {
    clearTimer();
    setHovered(photo);
  }, [clearTimer]);

  const handleMouseLeave = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => setHovered(null), 250);
  }, [clearTimer]);

  // Cleanup timer on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  // Built once per photo list rather than on every render. A `hovered` change
  // re-renders PhotoMap, and rebuilding this array there meant constructing a
  // <Marker> for every point each time the pointer moved — cost that scales with
  // the number of pins, which is exactly when the map is already heaviest.
  const markers = useMemo(
    () =>
      photos.map(
        (photo) =>
          photo.latitude != null &&
          photo.longitude != null && (
            <Marker
              key={photo.id}
              longitude={photo.longitude}
              latitude={photo.latitude}
              anchor="center"
            >
              <div
                onMouseEnter={() => handleMouseEnter(photo)}
                onMouseLeave={handleMouseLeave}
                onClick={(e) => {
                  e.stopPropagation();
                  // Toggle: tap same marker again to close. The timer is cleared
                  // first so a close scheduled by a just-passed mouseleave cannot
                  // fire 250ms later and blank the popup that this click opened.
                  clearTimer();
                  setHovered((prev) => (prev?.id === photo.id ? null : photo));
                }}
              >
                <DotMarker />
              </div>
            </Marker>
          ),
      ),
    [photos, handleMouseEnter, handleMouseLeave, clearTimer],
  );

  return (
    <div
      className="relative w-full"
      style={{ height: "calc(100svh - 4rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))" }}
    >
      <Map
        initialViewState={{
          longitude: 104,
          latitude: 32,
          zoom: 3.5,
        }}
        projection="globe"
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        attributionControl={false}
        localIdeographFontFamily="'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif"
        style={{ width: "100%", height: "100%" }}
        onClick={closePopup}
      >
        {markers}

        {hovered &&
          hovered.latitude != null &&
          hovered.longitude != null && (
            <Popup
              longitude={hovered.longitude}
              latitude={hovered.latitude}
              anchor="bottom"
              onClose={closePopup}
              closeButton={false}
              offset={16}
              className="[&_.maplibregl-popup-content]:!bg-transparent [&_.maplibregl-popup-content]:!p-0 [&_.maplibregl-popup-content]:!shadow-none [&_.maplibregl-popup-tip]:!hidden"
            >
              <div
                onMouseEnter={clearTimer}
                onMouseLeave={handleMouseLeave}
              >
                <PhotoPopup
                  photo={hovered}
                  onClose={closePopup}
                />
              </div>
            </Popup>
          )}
      </Map>
    </div>
  );
}
