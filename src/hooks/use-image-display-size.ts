"use client";

import { useEffect, useMemo, useState } from "react";

interface DisplaySize {
  width: number;
  height: number;
}

interface UseImageDisplaySizeOptions {
  /** Ratio of viewport height to use as max, default 0.8 (80vh) */
  maxHeightRatio?: number;
}

// ── Singleton resize listener (debounced, one global handler) ──

function getViewport(): { width: number; height: number } {
  if (typeof window === "undefined") return { width: 0, height: 0 };
  return { width: window.innerWidth, height: window.innerHeight };
}

type ResizeCb = () => void;
const _resizeCbs = new Set<ResizeCb>();
let _resizeTimer: ReturnType<typeof setTimeout> | null = null;

function _notifyResize() {
  for (const cb of _resizeCbs) cb();
}

function _onResize() {
  if (_resizeTimer) clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(_notifyResize, 120);
}

function subscribeResize(cb: ResizeCb): () => void {
  _resizeCbs.add(cb);
  if (_resizeCbs.size === 1) {
    window.addEventListener("resize", _onResize);
  }
  return () => {
    _resizeCbs.delete(cb);
    if (_resizeCbs.size === 0) {
      window.removeEventListener("resize", _onResize);
      if (_resizeTimer) clearTimeout(_resizeTimer);
    }
  };
}

/**
 * Calculate the optimal display size for a photo so it:
 * - Never exceeds a viewport-height ratio (responsive to screen size)
 * - Fills available width but respects a sensible maximum
 * - Preserves original aspect ratio
 *
 * Height cap is responsive:
 *   Mobile  (<640px):  65vh — leaves room to hint "more below"
 *   Tablet  (640-1024): 72vh
 *   Desktop (1024px+):  80vh
 *
 * Adapted from camlife's useImageDisplaySize.
 */
export function useImageDisplaySize(
  imageWidth: number,
  imageHeight: number,
  options: UseImageDisplaySizeOptions = {},
) {
  const { maxHeightRatio } = options;

  // Initialise synchronously from window.innerWidth/Height — no CLS
  const [viewport, setViewport] = useState(getViewport);

  // Subscribe to the singleton resize listener
  useEffect(() => {
    const sync = () => setViewport(getViewport());
    return subscribeResize(sync);
  }, []);

  const displaySize: DisplaySize = useMemo(() => {
    // Guard: SSR or not yet measured
    if (!imageWidth || !imageHeight) {
      return { width: imageWidth, height: imageHeight };
    }

    const vw = viewport.width || 1920;
    const vh = viewport.height || 1080;

    // ── Responsive height ratio ─────────────────
    // If caller overrides, use that; otherwise pick by viewport width
    const ratio =
      maxHeightRatio ??
      (vw < 640 ? 0.65 : vw < 1024 ? 0.72 : 0.80);

    // ── Max width: match our Tailwind container ─
    // w-[92%] → sm:w-[88%] → lg:max-w-4xl (896px)
    let maxWidth: number;
    if (vw >= 1024) {
      maxWidth = 896; // max-w-4xl
    } else if (vw >= 640) {
      maxWidth = vw * 0.88; // sm:w-[88%]
    } else {
      maxWidth = vw * 0.92; // w-[92%]
    }

    const maxHeight = vh * ratio;
    const aspect = imageWidth / imageHeight;

    let w = imageWidth;
    let h = imageHeight;

    // 1) Cap by height first (portrait images)
    if (h > maxHeight) {
      h = maxHeight;
      w = h * aspect;
    }

    // 2) Cap by width (landscape images that are very wide)
    if (w > maxWidth) {
      w = maxWidth;
      h = w / aspect;
    }

    return { width: Math.round(w), height: Math.round(h) };
  }, [imageWidth, imageHeight, viewport, maxHeightRatio]);

  return displaySize;
}
