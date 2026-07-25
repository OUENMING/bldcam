"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fires exactly once when the element enters the viewport.
 * Returns a stable ref callback and a boolean `inView`.
 *
 * Each call creates ONE IntersectionObserver that disconnects
 * after firing — dramatically cheaper than creating one per card.
 */
export function useInViewOnce(): {
  ref: (el: HTMLElement | null) => void;
  inView: boolean;
} {
  const [inView, setInView] = useState(false);
  const firedRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  const ref = useCallback((el: HTMLElement | null) => {
    if (!el || firedRef.current) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          firedRef.current = true;
          setInView(true);
          obs.disconnect();
          observerRef.current = null;
        }
      },
      { threshold: 0.05, rootMargin: "200px" },
    );

    obs.observe(el);
    observerRef.current = obs;
  }, []);

  return { ref, inView };
}
