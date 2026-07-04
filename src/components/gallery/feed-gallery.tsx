"use client";

import Image from "next/image";
import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useImageDisplaySize } from "@/hooks/use-image-display-size";
import { formatExifLine, formatLocation } from "@/lib/format";
import type { Photo } from "@prisma/client";

// ── Single feed card ───────────────────────────────
//
// Uses useImageDisplaySize (ported from camlife) to compute
// exact pixel dimensions for each photo.  The image container
// gets inline width/height so Next.js <Image fill> can use
// object-contain to scale-to-fit.
//
// Landscape → fills available width, height auto
// Portrait  → height capped at 80vh, width scales down
//             proportionally, dark sides appear naturally

function FeedCard({
  photo,
  priority,
  onClick,
}: {
  photo: Photo;
  priority?: boolean;
  onClick?: () => void;
}) {
  const [inView, setInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const exifLine = formatExifLine(photo);
  const locationLine = formatLocation(photo);

  const displaySize = useImageDisplaySize(photo.width, photo.height);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className={cn(
        "flex w-full flex-col items-center",
        "transition-[opacity,transform] duration-700 ease-out",
        inView && isLoaded
          ? "translate-y-0 opacity-100"
          : "translate-y-8 opacity-0",
      )}
    >
      {/* ── Image ────────────────────────────────── */}
      <div
        className="group relative cursor-pointer overflow-hidden rounded-3xl bg-background shadow-lg md:rounded-[2rem]"
        style={{
          width: displaySize.width,
          height: displaySize.height,
          maxWidth: "100%",
        }}
        onClick={onClick}
      >
        <Image
          fill
          placeholder="blur"
          blurDataURL={photo.blurDataUrl ?? undefined}
          src={photo.thumbnailUrl || photo.url}
          alt={photo.title}
          priority={priority}
          draggable={false}
          onLoad={() => setIsLoaded(true)}
          className={cn(
            "object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
          sizes={`(min-width: 1024px) ${displaySize.width}px, (min-width: 640px) 88vw, 92vw`}
        />
      </div>

      {/* ── Info panel ───────────────────────────── */}
      <div className="shrink-0 space-y-0.5 py-3 text-center sm:space-y-1 sm:py-4">
        <h2 className="font-semibold text-foreground text-base leading-tight sm:text-xl md:text-2xl">
          {photo.title}
        </h2>

        {exifLine && (
          <p className="font-medium text-muted-foreground text-xs tracking-wide sm:text-sm md:text-base">
            {exifLine}
          </p>
        )}

        {locationLine && (
          <p className="text-muted-foreground/70 text-xs sm:text-sm">
            {locationLine}
          </p>
        )}
      </div>
    </div>
  );
}

const MemoizedFeedCard = memo(FeedCard);

// ── Feed gallery ───────────────────────────────────

interface FeedGalleryProps {
  photos: Photo[];
  onPhotoClick: (index: number) => void;
}

export function FeedGallery({ photos, onPhotoClick }: FeedGalleryProps) {
  return (
    <div className="mx-auto flex w-[92%] max-w-4xl flex-col items-center gap-10 sm:gap-16 md:gap-20">
      {photos.map((photo, i) => (
        <MemoizedFeedCard
          key={photo.id}
          photo={photo}
          priority={i < 3}
          onClick={() => onPhotoClick(i)}
        />
      ))}
    </div>
  );
}
