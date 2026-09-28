"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseReveal {
  ref: (el: HTMLElement | null) => void;
  /** True only for an element that mounted off screen and was then scrolled in. */
  reveal: boolean;
}

/**
 * Whether an element should play an entrance animation.
 *
 * Deliberately not "is it in view". A card that is already on screen when it
 * mounts has to stay still: during a view-mode or filter swap the incoming cards
 * mount inside the viewport, so an entrance would start them at `opacity: 0` —
 * which is exactly the frame the browser captures for a view transition's
 * "after" snapshot, and every photo would fade in from nothing. Only a card that
 * mounts below the fold and is later scrolled into view animates.
 *
 * One observer per element, disconnected as soon as its answer is known.
 */
export function useReveal(): UseReveal {
  const [reveal, setReveal] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // React re-invokes `ref` when it rebinds the element; the entrance happens once.
  const settledRef = useRef(false);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const ref = useCallback((el: HTMLElement | null) => {
    // React calls this with null on unmount and again with a new element when
    // the node is replaced. Either way the previous observer has to go, or it
    // stays registered on a detached element until this component unmounts.
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el || settledRef.current) return;

    let firstReport = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (firstReport) {
          firstReport = false;
          if (entry.isIntersecting) {
            // Already on screen at mount — leave it alone for good.
            settledRef.current = true;
            observer.disconnect();
            observerRef.current = null;
          }
          // Otherwise it is below the fold; keep watching for the scroll-in.
          return;
        }
        if (entry.isIntersecting) {
          settledRef.current = true;
          setReveal(true);
          observer.disconnect();
          observerRef.current = null;
        }
      },
      { threshold: 0.05, rootMargin: "200px" },
    );

    observer.observe(el);
    observerRef.current = observer;
  }, []);

  return { ref, reveal };
}
