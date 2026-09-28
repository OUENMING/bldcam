"use client";

import { cn } from "@/lib/utils";
import type { Photo } from "@prisma/client";
import { MemoizedPhotoCard, type GalleryVariant } from "./photo-card";

const WATERFALL =
  "columns-1 gap-4 min-[420px]:columns-2 min-[420px]:gap-3 md:columns-3 md:gap-4 lg:columns-4";

const FEED =
  "mx-auto flex w-[92%] max-w-4xl flex-col items-center gap-10 sm:gap-16 md:gap-20";

interface PhotoGalleryProps {
  photos: Photo[];
  variant: GalleryVariant;
  onOpen: (index: number) => void;
}

/**
 * The container for both layouts — deliberately one element in one place.
 *
 * It used to be a bare `columns-*` div for the waterfall and a separate
 * `FeedGallery` component for the feed. React compares element types when it
 * reconciles, so a different parent type means the whole subtree below it is
 * destroyed and rebuilt: every card and every `<img>` created from scratch on
 * each switch. Measured on the live site with 77 photos loaded, that rebuild —
 * not the snapshots, which are handled separately — was the bulk of the 57 ms the
 * switch blocked the main thread for.
 *
 * One `<div>` now serves both, with only its class list swapped, so React keeps
 * the nodes and updates attributes instead.
 *
 * The two class sets are passed as alternatives rather than merged: `columns-*`
 * needs a block container and `flex` would break it, so only one of them may ever
 * be present.
 */
export function PhotoGallery({ photos, variant, onOpen }: PhotoGalleryProps) {
  return (
    <div className={cn(variant === "feed" ? FEED : WATERFALL)}>
      {photos.map((photo, i) => (
        <MemoizedPhotoCard
          key={photo.id}
          photo={photo}
          index={i}
          variant={variant}
          priority={i < 3}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
