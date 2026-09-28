"use client";

import Image from "next/image";
import Link from "next/link";
import { memo, type ComponentProps } from "react";
import { useReveal } from "@/hooks/use-reveal";
import { useImageDisplaySize } from "@/hooks/use-image-display-size";
import { cn } from "@/lib/utils";
import { photoViewTransitionName } from "@/lib/view-mode";
import { formatExifLine, formatLocation } from "@/lib/format";
import type { Photo } from "@prisma/client";

export type GalleryVariant = "waterfall" | "feed";

// ── Component ──────────────────────────────────────

interface PhotoCardProps {
  photo: Photo;
  /**
   * Position in the gallery. The card builds its own click handler from this plus
   * a stable `onOpen`, instead of the parent handing it a fresh arrow every render
   * — which is what made the memo below do nothing.
   */
  index: number;
  variant: GalleryVariant;
  priority?: boolean;
  onOpen?: (index: number) => void;
}

/**
 * One card, two presentations.
 *
 * The two layouts differ in almost everything — the outer wrapper, the frame's
 * radius and shadow, the image's sizing strategy, and whether the caption is an
 * overlay revealed on hover (waterfall) or a panel below the image (feed). They
 * are still one component on purpose: React can only reuse DOM nodes when the
 * element type at a position matches, and while these were two components every
 * switch tore down all 77 subtrees and built them again — 77 frames and 77
 * `<img>` elements created from scratch, which is most of the 57 ms the switch
 * blocks the main thread for. Everything variant-dependent is therefore a prop or
 * a class on the *same* element, never a different element in a different place.
 */
function PhotoCard({
  photo,
  index,
  variant,
  priority = false,
  onOpen,
}: PhotoCardProps) {
  const { ref, reveal } = useReveal();
  const exifLine = formatExifLine(photo);
  const isFeed = variant === "feed";

  // Called for both variants because a hook cannot be conditional, but subscribed
  // only for the feed branch — see the `enabled` option. Only the feed branch reads
  // the result, and only it needs the caption below the image.
  const displaySize = useImageDisplaySize(photo.width, photo.height, {
    enabled: isFeed,
  });
  const locationLine = isFeed ? formatLocation(photo) : "";

  // Typed as the union so one <Image> call site serves both layouts. Two call
  // sites would be two positions in the tree, and the image is the node worth
  // keeping: it is the largest thing on the page and the browser would otherwise
  // re-decode and re-lay-out all 77 of them on every switch.
  const sizeProps = (
    isFeed
      ? { fill: true as const }
      : { width: photo.width, height: photo.height }
  ) as ComponentProps<typeof Image>;

  return (
    <div
      ref={ref}
      // Visible unless the element mounted below the fold and has now scrolled in.
      // Nothing here hides the card, so a broken image or a snapshot taken
      // mid-transition can never produce an empty frame.
      //
      // `break-inside-avoid` makes the element a multi-column item, which is what
      // the waterfall layout relies on; the feed layout is a flex column instead.
      className={cn(
        isFeed
          ? "flex w-full flex-col items-center"
          : "mb-2 break-inside-avoid select-none sm:mb-3 md:mb-4",
        reveal && "card-reveal",
      )}
    >
      <div
        // The id is here as well as in the name so a transition can strip the name
        // from cards that are off screen — see src/lib/view-transition-cards.ts.
        data-vt-id={photo.id}
        style={{
          viewTransitionName: photoViewTransitionName(photo.id),
          // The feed frame is sized to the photo's fitted box so <Image fill> has
          // something to fill; the waterfall frame takes the column's width and
          // lets the image set the height.
          ...(isFeed
            ? {
                width: displaySize.width,
                // Ratio rather than a fixed pixel height. `maxWidth` can narrow the
                // box — a phone viewport, or the first render before the hook has
                // measured anything and it is still on its 1920×1080 fallback — and
                // a pinned height would then disagree with the photo's aspect, which
                // `object-cover` can only resolve by cropping. Measured vertical
                // portraits lost about 40% of their width that way.
                aspectRatio: `${displaySize.width} / ${displaySize.height}`,
                maxWidth: "100%",
              }
            : null),
        }}
        className={cn(
          "group relative cursor-pointer overflow-hidden",
          isFeed
            ? "rounded-3xl bg-background shadow-lg md:rounded-[2rem]"
            : "rounded-2xl bg-muted shadow-md transition-shadow duration-500 ease-out hover:shadow-xl md:shadow-lg md:hover:shadow-2xl",
        )}
        onClick={() => onOpen?.(index)}
      >
        {/* ── Image ──────────────────────────────── */}
        <Image
          {...sizeProps}
          // `placeholder="blur"` with no data URL throws inside next/image, and
          // blurDataUrl is nullable in the schema.
          placeholder={photo.blurDataUrl ? "blur" : "empty"}
          blurDataURL={photo.blurDataUrl ?? undefined}
          src={photo.thumbnailUrl || photo.url}
          alt={photo.title}
          priority={priority}
          draggable={false}
          className={cn(
            "transition-transform duration-700 ease-out",
            isFeed
              ? "object-cover group-hover:scale-[1.02]"
              : "h-auto w-full group-hover:scale-[1.03]",
          )}
          sizes={
            isFeed
              ? `(min-width: 1024px) ${displaySize.width}px, (min-width: 640px) 88vw, 92vw`
              : "(max-width: 420px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          }
        />

        {/* ── Waterfall caption: an overlay revealed on hover ──
              Hidden by default at all screen sizes. Revealed on hover (desktop).
              On mobile (no hover), clean image only — tap opens the lightbox with
              the full EXIF. */}
        {!isFeed && (
          <>
            <div
              className={cn(
                "absolute inset-0 rounded-2xl",
                "bg-gradient-to-t from-black/70 via-black/20 to-transparent",
                "opacity-0 transition-opacity duration-500 ease-out",
                "group-hover:opacity-100",
              )}
            />
            <div className="absolute inset-x-0 bottom-0 p-4">
              {/* h2 to match the feed caption — same content, same level. */}
              <h2
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
              </h2>
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
          </>
        )}
      </div>

      {/* ── Feed caption: a panel below the image, always visible ── */}
      {isFeed && (
        <div className="shrink-0 space-y-0.5 py-3 text-center sm:space-y-1 sm:py-4">
          {/* The title is the card's only keyboard route in — the frame is a div
              with onClick and is not focusable. The waterfall card links its title
              for the same reason; without this, keyboard users in feed mode could
              reach neither the detail page nor the lightbox. */}
          <h2 className="font-semibold text-foreground text-base leading-tight sm:text-xl md:text-2xl">
            {photo.slug ? (
              <Link href={`/photo/${photo.slug}`} className="hover:underline">
                {photo.title}
              </Link>
            ) : (
              photo.title
            )}
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
      )}
    </div>
  );
}

// `onOpen` is part of the comparison, so it has to be stable — the parent wraps it
// in useCallback. Leaving it out (the previous behaviour) silently reused a stale
// closure whenever the parent's handler changed. `variant` is here because the two
// presentations differ; without it a card would keep its old layout's classes.
export const MemoizedPhotoCard = memo(
  PhotoCard,
  (prev, next) =>
    prev.photo.id === next.photo.id &&
    prev.photo === next.photo &&
    prev.index === next.index &&
    prev.variant === next.variant &&
    prev.priority === next.priority &&
    prev.onOpen === next.onOpen,
);
