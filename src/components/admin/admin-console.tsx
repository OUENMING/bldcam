"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Aperture, LogOut, Upload, Images } from "lucide-react";
import { cn } from "@/lib/utils";
import { UploadZone } from "./upload-zone";
import { PhotoList } from "./photo-list";
import type { Photo } from "@prisma/client";

// ── Component ────────────────────────────────────────

interface AdminConsoleProps {
  initialPhotos: Photo[];
}

export function AdminConsole({ initialPhotos }: AdminConsoleProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [activeSection, setActiveSection] = useState<"upload" | "list">("upload");

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("已退出");
    router.refresh();
  }, [router]);

  // Merge newly uploaded photos into the list
  const handlePhotosUploaded = useCallback(
    (uploaded: Photo[]) => {
      setPhotos((prev) => [...uploaded, ...prev]);
      // Auto-switch to list view so user can verify
      setActiveSection("list");
    },
    [],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header — aligns with front-end Header ─── */}
      <header
        className="sticky top-0 z-30 flex h-16 items-center justify-between bg-background/90 px-4 backdrop-blur-md sm:px-6 md:px-8"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* Left: Brand — always goes to front gallery */}
        <a href="/" className="flex items-center gap-2.5">
          <Aperture
            className="size-6 text-foreground"
            strokeWidth={2.25}
            absoluteStrokeWidth
          />
          <span className="inline-flex items-baseline font-heading text-xl">
            <span className="font-bold tracking-widest text-foreground">BLD</span>
            <span className="font-normal italic tracking-wide text-primary">cam</span>
          </span>
        </a>

        {/* Right: Capsule bar */}
        <div className="flex items-center gap-x-3 rounded-full bg-card/60 px-4 py-2 backdrop-blur-md ring-1 ring-border/50">
          {/* Upload tab */}
          <button
            type="button"
            onClick={() => setActiveSection("upload")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-all",
              activeSection === "upload"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground/70",
            )}
            aria-pressed={activeSection === "upload"}
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">上传</span>
          </button>

          {/* List tab */}
          <button
            type="button"
            onClick={() => setActiveSection("list")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-all",
              activeSection === "list"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground/70",
            )}
            aria-pressed={activeSection === "list"}
          >
            <Images className="h-4 w-4" />
            <span className="hidden sm:inline">照片</span>
            {photos.length > 0 && (
              <span className="ml-0.5 rounded-full bg-muted/80 px-1.5 text-xs text-foreground/70">
                {photos.length}
              </span>
            )}
          </button>

          <Separator orientation="vertical" className="h-5 bg-muted" />

          {/* Logout */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground/80"
          >
            <LogOut className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">退出</span>
          </Button>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:px-8">
        {activeSection === "upload" && (
          <section>
            <div className="mb-6">
              <h2 className="font-semibold text-foreground text-lg">上传照片</h2>
              <p className="mt-1 text-muted-foreground text-sm">
                支持同时拖入或选择多张照片，每张走完整流水线（压缩 → EXIF → 缩略图 → R2）
              </p>
            </div>
            <UploadZone onPhotosUploaded={handlePhotosUploaded} />
          </section>
        )}

        {activeSection === "list" && (
          <section>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-foreground text-lg">
                  已上传照片
                </h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  {photos.length} 张 · 点击编辑图标修改标题或描述
                </p>
              </div>
            </div>
            <PhotoList photos={photos} onPhotosChange={setPhotos} />
          </section>
        )}
      </main>
    </div>
  );
}
