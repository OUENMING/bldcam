"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  THEME_COLORS,
  THEME_DARK_CLASS as DARK_CLASS,
  THEME_STORAGE_KEY as STORAGE_KEY,
} from "@/lib/theme-constants";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Fixed initial value so the server HTML and the first client render agree. The
  // FOUC script has already put the right class on <html>, so the paint is correct
  // — this state only has to catch up. Reading the class during render made the
  // client's first frame differ from the server's whenever the theme was light,
  // which showed up as a hydration error in ThemeSwitcher's icon.
  const [theme, setTheme] = useState<Theme>("dark");

  // The FOUC script has already applied the right class; this brings React's view of
  // it into step, once, after mount, and re-asserts the meta tag. If that script
  // threw (localStorage blocked, CSP) the meta stayed on the server's dark default
  // while the page rendered light — the browser chrome disagreed with the page.
  useEffect(() => {
    const current: Theme = document.documentElement.classList.contains(DARK_CLASS)
      ? "dark"
      : "light";
    // Reading the class during render is exactly what mismatched the two sides.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(current);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[current]);
  }, []);

  const toggle = () => {
    // Side effects live outside the updater: StrictMode double-invokes updaters,
    // which would toggle the class twice and land back on the original theme.
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode, quota) — the state still flips.
    }
    document.documentElement.classList.toggle(DARK_CLASS, next === "dark");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[next]);
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
