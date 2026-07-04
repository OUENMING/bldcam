"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/theme";

export function ThemeSwitcher() {
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
      className="cursor-pointer transition-colors duration-200 hover:text-muted-foreground"
    >
      {theme === "dark" ? (
        <Sun
          className="size-[22px] text-foreground transition-colors duration-200 hover:text-muted-foreground"
          strokeWidth={2.25}
          absoluteStrokeWidth
        />
      ) : (
        <Moon
          className="size-[22px] text-foreground transition-colors duration-200 hover:text-muted-foreground"
          strokeWidth={2.25}
          absoluteStrokeWidth
        />
      )}
    </button>
  );
}
