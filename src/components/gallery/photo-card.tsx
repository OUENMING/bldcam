"use client";

import Image from "next/image";
import Link from "next/link";
import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatExifLine } from "@/lib/format";
import type { Photo } from "@prisma/client";

// ── Component ──────────────────────────────────────

interface PhotoCardProps {
  photo: Photo;
  priority?: boolean;
  onClick?: () => void;
}

function PhotoCard({ photo, priority = false, onClick }: PhotoCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const exifLine = formatExifLine(photo);

  // ── Intersection Observer: scroll-triggered entry animation ──
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
        "mb-2 break-inside-avoid select-none sm:mb-3 md:mb-4",
        inView && isLoaded
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0",
        "transition-[opacity,transform] duration-700 ease-out",
      )}
    >
      <div
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-2xl",
          "bg-muted shadow-md transition-shadow duration-500 ease-out",
          "hover:shadow-xl md:shadow-lg md:hover:shadow-2xl",
        )}
        onClick={onClick}
      >
        {/* ── Image ──────────────────────────────── */}
        <Image
          placeholder="blur"
          blurDataURL={photo.blurDataUrl ?? undefined}
          src={photo.thumbnailUrl || photo.url}
          width={photo.width}
          height={photo.height}
          alt={photo.title}
          priority={priority}
          draggable={false}
          onLoad={() => setIsLoaded(true)}
          className={cn(
            "h-auto w-full",
            "transition-transform duration-700 ease-out",
            "group-hover:scale-[1.03]",
            isLoaded ? "" : "blur-md grayscale",
          )}
          sizes="(max-width: 420px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* ── Gradient overlay ─────────────────────
              Hidden by default at all screen sizes.
              Revealed on hover (desktop). On mobile
              (no hover), clean image only — tap
              opens lightbox with full EXIF.          */}
        <div
          className={cn(
            "absolute inset-0 rounded-2xl",
            "bg-gradient-to-t from-black/70 via-black/20 to-transparent",
            "opacity-0 transition-opacity duration-500 ease-out",
            "group-hover:opacity-100",
          )}
        />

        {/* ── Title + EXIF ─────────────────────────
            Hidden by default. Desktop: slide up on
            hover. Mobile: hidden — tap → lightbox.   */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3
            className={cn(
              "font-semibold text-white text-lg leading-tight drop-shadow-md",
              "translate-y-4 opacity-0",
              "group-hover:translate-y-0 group-hover:opacity-100",
              "transition-[opacity,transform] duration-500 ease-out",
            )}
          >
            {photo.slug ? (
              <Link
                href={`/photo/${photo.slug}`}
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {photo.title}
              </Link>
            ) : (
              photo.title
            )}
          </h3>
          {exifLine && (
            <p
              className={cn(
                "mt-0.5 text-white/80 text-sm drop-shadow-md",
                "translate-y-4 opacity-0",
                "group-hover:translate-y-0 group-hover:opacity-100",
                "transition-[opacity,transform] delay-75 duration-500 ease-out",
              )}
            >
              {exifLine}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export const MemoizedPhotoCard = memo(PhotoCard, (prev, next) =>
  prev.photo.id === next.photo.id && prev.priority === next.priority
);
