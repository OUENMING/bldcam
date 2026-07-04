"use client";

import { useCallback, useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { Photo } from "@prisma/client";
import { useViewMode } from "@/context/view-mode";
import { MemoizedPhotoCard } from "./photo-card";
import { FeedGallery } from "./feed-gallery";

const PhotoLightbox = dynamic(
  () => import("./photo-lightbox").then((m) => ({ default: m.PhotoLightbox })),
  { ssr: false },
);

const PAGE_SIZE = 20;

interface PhotoGridProps {
  initialPhotos: Photo[];
  totalCount: number;
  city?: string;
  category?: string;
}

export function PhotoGrid({
  initialPhotos,
  totalCount,
  city,
  category,
}: PhotoGridProps) {
  // ── Pagination state ──────────────────────────
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [cursor, setCursor] = useState<string | null>(
    initialPhotos.length >= PAGE_SIZE
      ? initialPhotos[initialPhotos.length - 1].id
      : null,
  );
  const [loading, setLoading] = useState(false);

  // ── Lightbox state ────────────────────────────
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  // Update URL bar when lightbox opens (no page navigation)
  useEffect(() => {
    if (open && photos[index]?.slug) {
      window.history.replaceState(null, "", `/photo/${photos[index].slug}`);
    }
  }, [open, index, photos[index]?.slug]);

  const { mode } = useViewMode();

  const hasMore = cursor !== null;
  const loadedCount = photos.length;

  // ── Fetch next page ───────────────────────────

  const fetchMore = useCallback(async () => {
    if (!hasMore || loading) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);
      if (city) params.set("city", city);
      if (category) params.set("category", category);

      const res = await fetch(`/api/photos?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as {
        photos: Photo[];
        nextCursor: string | null;
      };

      setPhotos((prev) => [...prev, ...data.photos]);
      setCursor(data.nextCursor);
    } catch (err) {
      console.error("Failed to fetch more photos:", err);
    } finally {
      setLoading(false);
    }
  }, [cursor, hasMore, loading, city, category]);

  // ── Sentinel observer (200px ahead) ───────────

  const { ref: sentinelRef, inView } = useInView({
    threshold: 0,
    rootMargin: "200px",
  });

  useEffect(() => {
    if (inView && hasMore && !loading) {
      fetchMore();
    }
  }, [inView, hasMore, loading, fetchMore]);

  // ═══════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════

  return (
    <>
      {/* ── Waterfall ──────────────────────────── */}
      {mode !== "feed" && (
        <div className="columns-1 gap-4 min-[420px]:columns-2 min-[420px]:gap-3 md:columns-3 md:gap-4 lg:columns-4">
          {photos.map((photo, i) => (
            <MemoizedPhotoCard
              key={photo.id}
              photo={photo}
              priority={i < 2}
              onClick={() => {
                setIndex(i);
                setOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* ── Feed ───────────────────────────────── */}
      {mode === "feed" && (
        <FeedGallery
          photos={photos}
          onPhotoClick={(i) => {
            setIndex(i);
            setOpen(true);
          }}
        />
      )}

      {/* ── Sentinel + loading / end indicator ──── */}
      <div
        ref={sentinelRef}
        className="flex items-center justify-center py-12"
      >
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">加载中…</span>
          </div>
        )}

        {!hasMore && loadedCount > 0 && !loading && (
          <p className="text-sm text-muted-foreground/70">
            {loadedCount >= totalCount
              ? `共 ${totalCount} 张照片`
              : "没有更多了"}
          </p>
        )}
      </div>

      {/* ── Lightbox ───────────────────────────── */}
      <PhotoLightbox
        photos={photos}
        open={open}
        index={index}
        onClose={() => {
          setOpen(false);
          window.history.replaceState(null, "", "/");
        }}
        onIndexChange={setIndex}
      />
    </>
  );
}
