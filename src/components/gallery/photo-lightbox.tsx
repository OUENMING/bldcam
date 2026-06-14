"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { cn } from "@/lib/utils";
import { formatDate, formatExposureTime, formatGps } from "@/lib/format";
import type { Photo } from "@prisma/client";

// ── Slide type — extend YARL's slide with our EXIF data ──

interface ExifSlide {
  src: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
  title: string;
  description: string;
  make: string | null;
  model: string | null;
  lensModel: string | null;
  fNumber: number | null;
  iso: number | null;
  exposureTime: number | null;
  focalLength35mm: number | null;
  focalLength: number | null;
  dateTimeOriginal: Date | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
}

// ── Custom Slide Render ─────────────────────────

function CustomSlide({ slide }: { slide: ExifSlide }) {
  const [loaded, setLoaded] = useState(false);

  // ── Build EXIF line ─────────────────────────
  const exifItems: { label: string; value: string }[] = [];
  if (slide.make || slide.model)
    exifItems.push({
      label: "相机",
      value: [slide.make, slide.model].filter(Boolean).join(" "),
    });
  if (slide.lensModel)
    exifItems.push({ label: "镜头", value: slide.lensModel });
  if (slide.fNumber)
    exifItems.push({ label: "光圈", value: `f/${slide.fNumber}` });
  if (slide.exposureTime)
    exifItems.push({
      label: "快门",
      value: formatExposureTime(slide.exposureTime),
    });
  if (slide.iso) exifItems.push({ label: "ISO", value: `ISO ${slide.iso}` });
  if (slide.focalLength35mm)
    exifItems.push({ label: "焦距", value: `${slide.focalLength35mm}mm` });
  else if (slide.focalLength)
    exifItems.push({ label: "焦距", value: `${slide.focalLength}mm` });
  if (slide.dateTimeOriginal)
    exifItems.push({
      label: "拍摄",
      value: formatDate(new Date(slide.dateTimeOriginal)),
    });
  const gps =
    slide.latitude && slide.longitude
      ? formatGps(slide.latitude, slide.longitude)
      : null;

  const location = [slide.city, slide.region, slide.country]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <Image
        src={slide.src}
        alt={slide.title}
        fill
        placeholder={slide.blurDataUrl ? "blur" : "empty"}
        blurDataURL={slide.blurDataUrl ?? undefined}
        priority
        onLoad={() => setLoaded(true)}
        className={cn(
          "object-contain",
          "transition-opacity duration-700 ease-out",
          loaded ? "opacity-100" : "opacity-0",
        )}
        sizes="(max-width: 768px) 100vw, 80vw"
      />

      {/* ── EXIF overlay ──────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/80 px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-10 text-center md:px-6">
        <h2 className="mb-0.5 font-semibold text-white text-sm drop-shadow-md">
          {slide.title}
        </h2>
        {slide.description && (
          <p className="mb-1 text-gray-400 text-xs drop-shadow-md">
            {slide.description}
          </p>
        )}
        {exifItems.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-0.5">
            {exifItems.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-baseline gap-1 text-xs"
              >
                <span className="text-gray-500">{item.label}</span>
                <span className="text-gray-200">{item.value}</span>
              </span>
            ))}
          </div>
        )}
        {(location || gps) && (
          <p className="mt-0.5 text-gray-500 text-xs">
            {location || gps}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────

interface PhotoLightboxProps {
  photos: Photo[];
  open: boolean;
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export function PhotoLightbox({
  photos,
  open,
  index,
  onClose,
  onIndexChange,
}: PhotoLightboxProps) {
  // Map photos to YARL-compatible slide data
  const slides = useMemo<ExifSlide[]>(
    () =>
      photos.map((p) => ({
        src: p.url,
        width: p.width,
        height: p.height,
        blurDataUrl: p.blurDataUrl,
        title: p.title,
        description: p.description,
        make: p.make,
        model: p.model,
        lensModel: p.lensModel,
        fNumber: p.fNumber,
        iso: p.iso,
        exposureTime: p.exposureTime,
        focalLength35mm: p.focalLength35mm,
        focalLength: p.focalLength,
        dateTimeOriginal: p.dateTimeOriginal,
        latitude: p.latitude,
        longitude: p.longitude,
        city: p.city,
        region: p.region,
        country: p.country,
      })),
    [photos],
  );

  return (
    <Lightbox
      open={open}
      index={index}
      slides={slides}
      plugins={[Zoom]}
      on={{
        view: useCallback(
          ({ index: i }: { index: number }) => onIndexChange(i),
          [onIndexChange],
        ),
      }}
      close={onClose}
      carousel={{ finite: true, preload: 2 }}
      animation={{ fade: 300, swipe: 300 }}
      zoom={{
        maxZoomPixelRatio: 3,
        zoomInMultiplier: 2,
        scrollToZoom: true,
      }}
      render={{
        slide: ({ slide }) => (
          <CustomSlide slide={slide as ExifSlide} />
        ),
        buttonZoom: () => null,
      }}
      styles={{
        container: {
          backgroundColor: "rgba(0, 0, 0, 0.95)",
          backdropFilter: "blur(12px)",
        },
      }}
    />
  );
}
