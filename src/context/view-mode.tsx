"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

// ── Types ──────────────────────────────────────────

export type ViewMode = "waterfall" | "feed";

interface ViewModeContextValue {
  mode: ViewMode;
  toggle: () => void;
}

// ── Context ────────────────────────────────────────

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

// ── Provider ───────────────────────────────────────

/** Read by the server layout, written by `toggle` below. */
export const VIEW_MODE_COOKIE = "bldcam-view-mode";

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
    setMode(next);
    // A cookie rather than localStorage so the server can act on it. SameSite=Lax
    // is plenty — this is a display preference, not a credential.
    document.cookie = `${VIEW_MODE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
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
