"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Map, { Marker, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
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

  const location = [photo.city, photo.region, photo.country]
    .filter(Boolean)
    .join(" · ");

  const coords = photo.latitude && photo.longitude
    ? `${photo.latitude.toFixed(4)}°, ${photo.longitude.toFixed(4)}°`
    : null;

  const exif = [
    photo.focalLength35mm && `${photo.focalLength35mm}mm`,
    photo.fNumber && `f/${photo.fNumber}`,
    photo.iso && `ISO ${photo.iso}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const hasCity = !!photo.city;

  return (
    <div className="w-64 rounded-xl border border-amber-600/30 bg-[#09090b] p-3 shadow-[0_0_25px_-5px_rgba(217,119,6,0.15)]">
      {/* Thumbnail */}
      {photo.thumbnailUrl && (
        <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-md bg-neutral-800">
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
      <h3 className="font-semibold text-white text-sm">{photo.title}</h3>

      {/* Location or coords */}
      {location && (
        <p className="mt-0.5 truncate text-gray-400 text-xs">{location}</p>
      )}
      {!location && coords && (
        <p className="mt-0.5 truncate text-gray-500 text-xs">{coords}</p>
      )}

      {/* EXIF */}
      {exif && <p className="mt-1 text-gray-500 text-xs">{exif}</p>}

      {/* Action: go to city page */}
      {hasCity && (
        <button
          type="button"
          onClick={() => {
            router.push(`/?city=${encodeURIComponent(photo.city!)}`);
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

  const handleMouseEnter = useCallback((photo: MapPhoto) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHovered(photo);
  }, []);

  const handleMouseLeave = useCallback(() => {
    timerRef.current = setTimeout(() => setHovered(null), 250);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="relative h-[calc(100svh-4rem)] w-full">
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
        onClick={() => setHovered(null)}
      >
        {photos.map(
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
                >
                  <DotMarker />
                </div>
              </Marker>
            ),
        )}

        {hovered &&
          hovered.latitude != null &&
          hovered.longitude != null && (
            <Popup
              longitude={hovered.longitude}
              latitude={hovered.latitude}
              anchor="bottom"
              onClose={() => setHovered(null)}
              closeButton={false}
              offset={16}
              className="[&_.maplibregl-popup-content]:!bg-transparent [&_.maplibregl-popup-content]:!p-0 [&_.maplibregl-popup-content]:!shadow-none [&_.maplibregl-popup-tip]:!hidden"
            >
              <div
                onMouseEnter={() => {
                  if (timerRef.current) clearTimeout(timerRef.current);
                }}
                onMouseLeave={handleMouseLeave}
              >
                <PhotoPopup
                  photo={hovered}
                  onClose={() => setHovered(null)}
                />
              </div>
            </Popup>
          )}
      </Map>
    </div>
  );
}
