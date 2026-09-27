"use client";

import type { ReactNode } from "react";
// Typed in @types/react/canary.d.ts, which this project already picks up.
import { ViewTransition } from "react";

/**
 * Animates the gallery across router navigations, which is what a filter change
 * is — the sidebar links are `<Link>`, so the photos that survive the filter and
 * the ones that arrive are only related by React's own transition machinery.
 *
 * Inert unless `experimental.viewTransition` is on in next.config.ts, and React
 * refuses to start a transition while a `flushSync` is in flight, so this module
 * must not be the one driving `document.startViewTransition` by hand.
 */
export function GalleryTransition({ children }: { children: ReactNode }) {
  return <ViewTransition>{children}</ViewTransition>;
}
