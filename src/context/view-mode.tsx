"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

const STORAGE_KEY = "bldcam-view-mode";

function readStored(): ViewMode {
  if (typeof window === "undefined") return "waterfall";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "feed") return "feed";
  return "waterfall";
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ViewMode>("waterfall");

  // Hydrate from localStorage on mount (avoid SSR mismatch)
  useEffect(() => {
    setMode(readStored());
  }, []);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next: ViewMode = prev === "waterfall" ? "feed" : "waterfall";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

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
