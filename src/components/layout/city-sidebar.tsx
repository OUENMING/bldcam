"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MapPin,
  Tag,
} from "lucide-react";

interface CityInfo {
  city: string;
  count: number;
}

interface CategoryInfo {
  category: string;
  count: number;
}

interface CitySidebarProps {
  cities: CityInfo[];
  categories: CategoryInfo[];
  totalCount: number;
}

export function CitySidebar({
  cities,
  categories,
  totalCount,
}: CitySidebarProps) {
  const searchParams = useSearchParams();
  const activeCity = searchParams.get("city") ?? "";
  const activeCategory = searchParams.get("category") ?? "";

  // ── Collapse states ──────────────────────────────
  const [collapsed, setCollapsed] = useState(true); // sidebar hidden by default
  const [cityOpen, setCityOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  // ── Auto-collapse on navigation (mobile only) ──
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setCollapsed(true);
    }
  }, [activeCity, activeCategory]);

  // ── Build link hrefs ─────────────────────────────
  function cityHref(city: string) {
    return activeCity === city ? "/" : `/?city=${encodeURIComponent(city)}`;
  }
  function categoryHref(cat: string) {
    return activeCategory === cat
      ? "/"
      : `/?category=${encodeURIComponent(cat)}`;
  }

  return (
    <>
      {/* ── Overlay backdrop (mobile only) ────────── */}
      <div
        className={cn(
          "fixed inset-0 z-[9] bg-black/50 transition-opacity duration-300 md:hidden",
          collapsed ? "pointer-events-none opacity-0" : "opacity-100",
        )}
        onClick={() => setCollapsed(true)}
      />

      {/* ── Toggle button ───────────────────────── */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className={cn(
          "fixed top-20 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-border/50 bg-background text-muted-foreground shadow-sm transition-all duration-300 hover:text-foreground",
          // Mobile: toggle stays at left edge
          // Desktop: follows sidebar edge
          collapsed
            ? "left-1"
            : "left-1 md:left-[212px]",
        )}
        aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>

      {/* ── Sidebar panel ────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-10 flex flex-col border-r border-border/50 bg-background/80 backdrop-blur-md transition-all duration-300 ease-out md:bg-background/80",
          // Mobile: overlay (no spacer), desktop: inline (with spacer)
          collapsed ? "w-0 overflow-hidden border-0 opacity-0" : "w-56",
        )}
      >
        {/* ── 全部照片 ───────────────────────────── */}
        <div className="px-4 pt-18 pb-3">
          <Link
            href="/"
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
              !activeCity && !activeCategory
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>全部照片</span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {totalCount}
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-8 space-y-4" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}>
          {/* ══════════════════════════════════════════ */}
          {/* ── 城市 ───────────────────────────────── */}
          {/* ══════════════════════════════════════════ */}
          <section>
            <button
              type="button"
              onClick={() => setCityOpen((v) => !v)}
              className="flex w-full items-center gap-1.5 px-3 py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="font-medium text-xs uppercase tracking-wider">
                城市
              </span>
              <span className="text-muted-foreground/60 text-[10px] tabular-nums">
                ({cities.length})
              </span>
              <ChevronDown
                className={cn(
                  "ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                  cityOpen && "rotate-180",
                )}
              />
            </button>

            <div
              className={cn(
                "grid transition-all duration-200 ease-out",
                cityOpen
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                {cities.length > 0 ? (
                  <ul className="space-y-0.5 pt-1">
                    {cities.map(({ city, count }) => (
                      <li key={city}>
                        <Link
                          href={cityHref(city)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                            activeCity === city
                              ? "bg-muted font-medium text-foreground"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                          )}
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0 opacity-50" />
                          <span className="flex-1 truncate">{city}</span>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {count}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 pt-1 text-muted-foreground/60 text-xs">
                    上传带 GPS 坐标的照片后自动显示
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════ */}
          {/* ── 分类 ───────────────────────────────── */}
          {/* ══════════════════════════════════════════ */}
          <section>
            <button
              type="button"
              onClick={() => setCategoryOpen((v) => !v)}
              className="flex w-full items-center gap-1.5 px-3 py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="font-medium text-xs uppercase tracking-wider">
                分类
              </span>
              <span className="text-muted-foreground/60 text-[10px] tabular-nums">
                ({categories.length})
              </span>
              <ChevronDown
                className={cn(
                  "ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                  categoryOpen && "rotate-180",
                )}
              />
            </button>

            <div
              className={cn(
                "grid transition-all duration-200 ease-out",
                categoryOpen
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                {categories.length > 0 ? (
                  <ul className="space-y-0.5 pt-1">
                    {categories.map(({ category, count }) => (
                      <li key={category}>
                        <Link
                          href={categoryHref(category)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                            activeCategory === category
                              ? "bg-muted font-medium text-foreground"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                          )}
                        >
                          <Tag className="h-3.5 w-3.5 shrink-0 opacity-50" />
                          <span className="flex-1 truncate">{category}</span>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {count}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 pt-1 text-muted-foreground/60 text-xs">
                    上传照片时 AI 自动分类
                  </p>
                )}
              </div>
            </div>
          </section>
        </nav>
      </aside>

      {/* ── Spacer — desktop only (mobile uses overlay) */}
      <div
        className={cn(
          "hidden shrink-0 transition-all duration-300 md:block",
          collapsed ? "w-0" : "w-56",
        )}
      />
    </>
  );
}
