"use client";

import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";
import { photoViewTransitionName } from "@/lib/view-mode";
import { formatExifLine } from "@/lib/format";
import type { Photo } from "@prisma/client";

// ── Component ──────────────────────────────────────

interface PhotoCardProps {
  photo: Photo;
  /**
   * Position in the gallery. The card builds its own click handler from this plus
   * a stable `onOpen`, instead of the parent handing it a fresh arrow every render
   * — which is what made the memo below do nothing.
   */
  index: number;
  priority?: boolean;
  onOpen?: (index: number) => void;
}

function PhotoCard({ photo, index, priority = false, onOpen }: PhotoCardProps) {
  const { ref, reveal } = useReveal();
  const exifLine = formatExifLine(photo);

  return (
    <div
      ref={ref}
      // Visible unless the element mounted below the fold and has now scrolled
      // in. Nothing here hides the card, so a broken image or a snapshot taken
      // mid-transition can never produce an empty frame.
      className={cn(
        "mb-2 break-inside-avoid select-none sm:mb-3 md:mb-4",
        reveal && "card-reveal",
      )}
    >
      <div
        // Pairs this frame with the same photo's frame in the feed gallery, so a
        // view-mode switch moves the photo between the two geometries instead of
        // cutting. Names must be unique per document — the two galleries never
        // render at once, so one name per photo is enough.
        style={{ viewTransitionName: photoViewTransitionName(photo.id) }}
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-2xl",
          "bg-muted shadow-md transition-shadow duration-500 ease-out",
          "hover:shadow-xl md:shadow-lg md:hover:shadow-2xl",
        )}
        onClick={() => onOpen?.(index)}
      >
        {/* ── Image ──────────────────────────────── */}
        <Image
          // `placeholder="blur"` with no data URL throws inside next/image, and
          // blurDataUrl is nullable in the schema.
          placeholder={photo.blurDataUrl ? "blur" : "empty"}
          blurDataURL={photo.blurDataUrl ?? undefined}
          src={photo.thumbnailUrl || photo.url}
          width={photo.width}
          height={photo.height}
          alt={photo.title}
          priority={priority}
          draggable={false}
          className={cn(
            "h-auto w-full",
            "transition-transform duration-700 ease-out",
            "group-hover:scale-[1.03]",
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
              "translate-y-4 opacity-0 pointer-events-none",
              // pointer-events, not `invisible`: this link is the only keyboard
              // route into the card (the card itself is a div with onClick), so
              // hiding it from the tab order would cost more than it fixes. On a
              // touch screen there is no hover, so taps now fall through to the
              // card and open the lightbox instead of jumping to the detail page.
              "group-hover:translate-y-0 group-hover:opacity-100 group-hover:pointer-events-auto",
              // Tabbing to the link reveals the block, so the focus ring is on
              // something visible (WCAG 2.4.7).
              "focus-within:translate-y-0 focus-within:opacity-100 focus-within:pointer-events-auto",
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

// onOpen is part of the comparison, so it has to be stable — the parent wraps it in
// useCallback. Leaving it out (the previous behaviour) silently reused a stale
// closure whenever the parent's handler changed.
export const MemoizedPhotoCard = memo(
  PhotoCard,
  (prev, next) =>
    prev.photo.id === next.photo.id &&
    prev.photo === next.photo &&
    prev.index === next.index &&
    prev.priority === next.priority &&
    prev.onOpen === next.onOpen,
);
