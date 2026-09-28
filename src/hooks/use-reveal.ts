"use client";

import { useCallback, useRef, useState } from "react";

interface UseReveal {
  ref: (el: HTMLElement | null) => void;
  /** True only for an element that mounted off screen and was then scrolled in. */
  reveal: boolean;
}

/**
 * How far outside the viewport still counts as "about to be seen".
 *
 * Both decisions below use this one value, and they have to agree. It is the band
 * where the entrance is already underway by the time the card crosses the edge,
 * so a fast scroll never shows a card that is still fully transparent at the crop
 * edge — and therefore also the band where a freshly mounted card counts as
 * already on screen. When the two disagreed, a card landing in this band at mount
 * was judged off screen, then immediately reported as intersecting, and burned
 * its entrance while still below the fold.
 */
const PRE_TRIGGER_PX = 200;

/**
 * Whether an element should play an entrance animation.
 *
 * Deliberately not "is it in view". A card that is already on screen when it
 * mounts has to stay still: during a view-mode or filter swap the incoming cards
 * mount inside the viewport, so an entrance would start them at `opacity: 0` —
 * which is exactly the frame the browser captures for a view transition's
 * "after" snapshot, and every photo would fade in from nothing.
 *
 * One observer per element, disconnected as soon as its answer is known, and
 * again with null on unmount — that is the only unmount path; there is no
 * separate effect doing the same job.
 */
export function useReveal(): UseReveal {
  const [reveal, setReveal] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // React re-invokes `ref` when it rebinds the element; the entrance happens once.
  const settledRef = useRef(false);

  const ref = useCallback((el: HTMLElement | null) => {
    // React calls this with null on unmount and again with a new element when
    // the node is replaced, so the previous observer has to go either way or it
    // stays registered on a detached element.
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el || settledRef.current) return;

    // Read the mount-time geometry synchronously rather than waiting for the
    // observer's first callback. That callback is delivered during the rendering
    // steps, not as a microtask, so hydration or a slow first layout can let the
    // user scroll before it arrives — and a card that mounted below the fold
    // would then report as already visible and lose its entrance for good.
    const rect = el.getBoundingClientRect();
    const withinPreTriggerBand =
      rect.top < window.innerHeight + PRE_TRIGGER_PX &&
      rect.bottom > -PRE_TRIGGER_PX;
    if (withinPreTriggerBand) {
      settledRef.current = true;
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        settledRef.current = true;
        setReveal(true);
        observer.disconnect();
        observerRef.current = null;
      },
      { threshold: 0.05, rootMargin: `${PRE_TRIGGER_PX}px` },
    );

    observer.observe(el);
    observerRef.current = observer;
  }, []);

  return { ref, reveal };
}
