"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { VIEW_MODE_COOKIE, type ViewMode } from "@/lib/view-mode";

// ── Types ──────────────────────────────────────────

interface ViewModeContextValue {
  mode: ViewMode;
  toggle: () => void;
}

// ── Context ────────────────────────────────────────

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

// ── Provider ───────────────────────────────────────

export function ViewModeProvider({
  children,
  initialMode,
}: {
  children: ReactNode;
  initialMode: ViewMode;
}) {
  // The layout reads the cookie and hands the value down, so the server and the
  // first client render already agree. The preference used to live in localStorage,
  // which the server cannot see — it could only guess "waterfall", and React then
  // corrected after hydration, re-mounting the whole gallery for anyone on "feed".
  const [mode, setMode] = useState<ViewMode>(initialMode);

  const toggle = useCallback(() => {
    // Computed outside the updater on purpose: an updater must be pure, and
    // StrictMode invokes it twice.
    const next: ViewMode = mode === "waterfall" ? "feed" : "waterfall";
    const apply = () => {
      setMode(next);
      // A cookie rather than localStorage so the server can act on it. SameSite=Lax
      // is plenty — this is a display preference, not a credential.
      document.cookie = `${VIEW_MODE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    };

    // Swapping the galleries is a layout change over the same photos, so the
    // browser can interpolate it if the cards are named (see globals.css). Every
    // other route through this function is the plain state update.
    if (
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      apply();
      return;
    }

    // The browser captures the "after" snapshot the moment this callback returns,
    // so the render has to be synchronous — a concurrent one would not have
    // committed yet. Resetting the cards' reveal state for that capture is keyed
    // on the `:active-view-transition` pseudo-class (see globals.css), so there is
    // nothing to set here and nothing to clean up afterwards.
    let applied = false;
    const transition = document.startViewTransition(() => {
      applied = true;
      flushSync(apply);
    });

    // `ready` rejects whenever the transition does not actually run, and in some
    // of those cases the update callback never runs either — a hidden document
    // does exactly that (reproduced: InvalidStateError, mode unchanged, cookie
    // never written). Losing the animation there is acceptable; leaving a
    // control that does nothing is not, so fall back to the plain update. When
    // the callback did run this is a no-op.
    //
    // The same catch also handles the plain rejection leak: a skipped transition
    // rejects both `ready` and `finished`, and nothing else reads them. Measured
    // with these removed: three rapid clicks produced two unhandled AbortErrors.
    // (`updateCallbackDone` does not reject — measured.)
    transition.ready.catch(() => {
      if (!applied) apply();
    });
    transition.finished.catch(() => {});
  }, [mode]);

  return (
    <ViewModeContext.Provider value={{ mode, toggle }}>
      {children}
    </ViewModeContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext);
  if (!ctx) {
    throw new Error("useViewMode must be used within <ViewModeProvider>");
  }
  return ctx;
}
