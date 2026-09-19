"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Photo } from "@prisma/client";
import { useViewMode } from "@/context/view-mode";
import { MemoizedPhotoCard } from "./photo-card";
import { FeedGallery } from "./feed-gallery";
import { ShareDialog } from "./share-dialog";

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
  const [loadError, setLoadError] = useState(false);

  // ── Lightbox state ────────────────────────────
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  // Save the gallery URL (with active filter) before the lightbox rewrites
  // history, so closing restores it instead of dumping to "/".
  const galleryUrlRef = useRef<string | null>(null);

  // ── Share dialog state ─────────────────────────
  const [sharePhotoId, setSharePhotoId] = useState<string | null>(null);
  const [sharePhotoTitle, setSharePhotoTitle] = useState("");
  // Stable ref to latest photos array so handleShare doesn't
  // depend on it directly (avoids YARL toolbar re-mount on pagination)
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // Sync URL when the lightbox opens
  useEffect(() => {
    if (!open) return;
    // Capture the pre-lightbox URL once, even when this photo has no slug. The
    // close handler restores from this either way, and skipping the capture meant
    // closing replaced the URL with "/" and dropped the active city/category filter.
    if (!window.location.pathname.startsWith("/photo/") && !galleryUrlRef.current) {
      galleryUrlRef.current = window.location.href;
    }
    const slug = photos[index]?.slug;
    if (slug) {
      window.history.replaceState({ lightboxIndex: index }, "", `/photo/${slug}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, photos[index]?.slug]);

  // Registered once. It used to live in the effect above, so every step through the
  // gallery tore the listener down and added it again.
  useEffect(() => {
    const onPop = () => {
      // Browser back/forward closes the lightbox. Clear the captured URL too:
      // leaving it set made the next open skip the capture and then restore a URL
      // from before the previous session.
      galleryUrlRef.current = null;
      setOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const { mode } = useViewMode();

  const hasMore = cursor !== null;
  const loadedCount = photos.length;

  const handleShare = useCallback((photoId: string) => {
    const p = photosRef.current.find((ph) => ph.id === photoId);
    if (!p) return;
    setSharePhotoId(photoId);
    setSharePhotoTitle(p.title);
  }, []);

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
      // Stop the sentinel from re-firing. Leaving hasMore true with inView still
      // true made the effect below call fetchMore again the moment `loading` went
      // back to false, so a persistent 5xx turned into a request storm against
      // our own API.
      setLoadError(true);
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
    if (inView && hasMore && !loading && !loadError) {
      fetchMore();
    }
  }, [inView, hasMore, loading, loadError, fetchMore]);

  // ═══════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════

  // Stable identity, so the memo on each card actually holds: an inline arrow here
  // was a new function on every render, and the cards are what the memo is for.
  const openPhoto = useCallback((i: number) => {
    setIndex(i);
    setOpen(true);
  }, []);

  return (
    <>
      {/* ── Waterfall ──────────────────────────── */}
      {mode !== "feed" && (
        <div className="columns-1 gap-4 min-[420px]:columns-2 min-[420px]:gap-3 md:columns-3 md:gap-4 lg:columns-4">
          {photos.map((photo, i) => (
            <MemoizedPhotoCard
              key={photo.id}
              photo={photo}
              index={i}
              priority={i < 2}
              onOpen={openPhoto}
            />
          ))}
        </div>
      )}

      {/* ── Feed ───────────────────────────────── */}
      {mode === "feed" && (
        <FeedGallery photos={photos} onPhotoClick={openPhoto} />
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

        {loadError && !loading && (
          <Button
            variant="link"
            size="sm"
            onClick={() => setLoadError(false)}
            className="text-muted-foreground"
          >
            加载失败，点击重试
          </Button>
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
          const prev = galleryUrlRef.current ?? "/";
          galleryUrlRef.current = null;
          window.history.replaceState(null, "", prev);
        }}
        onIndexChange={setIndex}
        onShare={handleShare}
      />

      {/* ── Share dialog ────────────────────────── */}
      {sharePhotoId && (
        <ShareDialog
          photoId={sharePhotoId}
          photoTitle={sharePhotoTitle}
          open={sharePhotoId !== null}
          onOpenChange={(val) => {
            if (!val) setSharePhotoId(null);
          }}
          key={sharePhotoId}
        />
      )}
    </>
  );
}
