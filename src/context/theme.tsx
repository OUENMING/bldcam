"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "bldcam-theme";
const DARK_CLASS = "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads the class set by the FOUC blocking script —
  // zero hydration mismatch. SSR falls back to "dark".
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains(DARK_CLASS) ? "dark" : "light";
    }
    return "dark";
  });

  const toggle = () => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.classList.toggle(DARK_CLASS, next === "dark");
      return next;
    });
  };

  return (
    <ThemeContext value={{ theme, toggle }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
