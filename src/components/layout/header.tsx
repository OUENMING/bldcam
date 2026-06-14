"use client";

import Link from "next/link";
import { Aperture, Columns2, Globe, LayoutDashboard, Rows3 } from "lucide-react";
import { useViewMode } from "@/context/view-mode";

export function Header() {
  const { mode, toggle } = useViewMode();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-black px-4 backdrop-blur-sm sm:px-6 md:px-8">
      {/* ── Left: Brand ──────────────────────────── */}
      <Link href="/" className="flex items-center gap-2.5 group">
        <Aperture
          className="size-6 text-white transition-transform duration-300 group-hover:rotate-45"
          strokeWidth={2.25}
          absoluteStrokeWidth
        />
        <span className="font-serif font-bold text-white text-lg tracking-wide sm:text-xl md:text-2xl">
          BLDcam
        </span>
      </Link>

      {/* ── Right: Capsule bar ────────────────────── */}
      <div className="flex items-center gap-x-3 rounded-full bg-zinc-900 px-3 py-2 sm:gap-x-5 sm:px-5">
        {/* View mode toggle */}
        <button
          type="button"
          onClick={toggle}
          aria-label={mode === "waterfall" ? "切换到单列流" : "切换到瀑布流"}
          className="cursor-pointer transition-colors duration-200 hover:text-zinc-400"
        >
          {mode === "waterfall" ? (
            <Rows3
              className="size-[22px] text-white transition-colors duration-200 hover:text-zinc-400"
              strokeWidth={2.25}
              absoluteStrokeWidth
            />
          ) : (
            <Columns2
              className="size-[22px] text-white transition-colors duration-200 hover:text-zinc-400"
              strokeWidth={2.25}
              absoluteStrokeWidth
            />
          )}
        </button>

        {/* Map */}
        <Link href="/map">
          <Globe
            className="size-[22px] cursor-pointer text-white transition-colors duration-200 hover:text-zinc-400"
            strokeWidth={2.25}
            absoluteStrokeWidth
          />
        </Link>

        {/* GitHub */}
        <a
          href="https://github.com/OUENMING"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-[22px] cursor-pointer fill-white transition-colors duration-200 hover:fill-zinc-400"
          >
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        </a>

        {/* Admin */}
        <Link href="/admin">
          <LayoutDashboard
            className="size-[22px] cursor-pointer text-white transition-colors duration-200 hover:text-zinc-400"
            strokeWidth={2.25}
            absoluteStrokeWidth
          />
        </Link>
      </div>
    </header>
  );
}
