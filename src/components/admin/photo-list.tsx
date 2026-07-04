"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, X, Check, Loader2, RotateCw, Images } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatExifLine, formatLocation } from "@/lib/format";
import type { Photo } from "@prisma/client";

// ── Helpers ─────────────────────────────────────────

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ────────────────────────────────────────

interface PhotoListProps {
  photos: Photo[];
  onPhotosChange: (photos: Photo[]) => void;
}

export function PhotoList({ photos, onPhotosChange }: PhotoListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Photo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [rotating, setRotating] = useState(false);

  // ── Rotate logic ─────────────────────────────────

  const handleRotate = useCallback(
    async (photo: Photo, angle: number) => {
      if (rotating) return;
      setRotating(true);
      try {
        const res = await fetch("/api/photos/rotate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: photo.id, angle }),
        });
        if (!res.ok) throw new Error(await res.text());
        const updated = (await res.json()) as Photo;
        onPhotosChange(
          photos.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
        );
        toast.success("已旋转");
      } catch {
        toast.error("旋转失败");
      } finally {
        setRotating(false);
      }
    },
    [rotating, photos, onPhotosChange],
  );

  // ── Edit logic ──────────────────────────────────

  const startEditing = useCallback((photo: Photo) => {
    setEditingId(photo.id);
    setEditTitle(photo.title);
    setEditDescription(photo.description || "");
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
  }, []);

  const saveEdit = useCallback(
    async (id: string) => {
      if (!editTitle.trim()) {
        toast.error("标题不能为空");
        return;
      }

      setSaving(true);
      try {
        const res = await fetch("/api/photos", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            title: editTitle.trim(),
            description: editDescription.trim(),
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown" }));
          throw new Error(err.error);
        }

        const updated = (await res.json()) as Photo;
        onPhotosChange(
          photos.map((p) => (p.id === id ? { ...p, ...updated } : p)),
        );
        toast.success("已保存");
        cancelEditing();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "保存失败",
        );
      } finally {
        setSaving(false);
      }
    },
    [editTitle, editDescription, photos, onPhotosChange, cancelEditing],
  );

  // ── Delete logic ────────────────────────────────

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown" }));
        throw new Error(err.error);
      }

      onPhotosChange(photos.filter((p) => p.id !== deleteTarget.id));
      toast.success(`已删除「${deleteTarget.title}」`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "删除失败",
      );
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, photos, onPhotosChange]);

  // ── Render ──────────────────────────────────────

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-3 rounded-full bg-card p-4">
          <Images className="size-8 opacity-30" />
        </div>
        <p className="text-muted-foreground text-sm">还没有上传照片</p>
        <p className="mt-1 text-muted-foreground/70 text-xs">
          在上方拖拽或选择照片开始上传
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ── Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => {
          const isEditing = editingId === photo.id;
          const summary = formatExifLine(photo);
          const location = formatLocation(photo);
          const size = formatSize(photo.fileSize);

          return (
            <div
              key={photo.id}
              className={cn(
                "group overflow-hidden rounded-xl border border-border bg-card/50 transition-colors",
                isEditing && "border-amber-500/30 bg-card",
              )}
            >
              {/* Thumbnail */}
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <Image
                  src={photo.thumbnailUrl || photo.url}
                  alt={photo.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>

              {/* Info */}
              <div className="space-y-1.5 p-3">
                {isEditing ? (
                  /* ── Edit mode ──────────────── */
                  <div className="space-y-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="标题"
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(photo.id);
                        if (e.key === "Escape") cancelEditing();
                      }}
                    />
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="描述（可选）"
                      className="h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(photo.id);
                        if (e.key === "Escape") cancelEditing();
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveEdit(photo.id)}
                        disabled={saving || !editTitle.trim()}
                      >
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1">保存</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEditing}
                        disabled={saving}
                      >
                        <X className="h-3.5 w-3.5" />
                        <span className="ml-1">取消</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ── Display mode ───────────── */
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm text-foreground/80 leading-snug line-clamp-1">
                        {photo.title}
                      </h3>
                      <div className="flex shrink-0 gap-0.5 opacity-100 md:opacity-0 transition-opacity md:group-hover:opacity-100">
                        {/* Rotate buttons */}
                        <button
                          type="button"
                          onClick={() => handleRotate(photo, -90)}
                          disabled={rotating}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground/80 transition-colors disabled:opacity-30"
                          title="向左旋转 90°"
                        >
                          <RotateCw className="h-3.5 w-3.5 rotate-[270deg]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotate(photo, 90)}
                          disabled={rotating}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground/80 transition-colors disabled:opacity-30"
                          title="向右旋转 90°"
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                        </button>
                        {/* Edit button */}
                        <button
                          type="button"
                          onClick={() => startEditing(photo)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground/80 transition-colors"
                          title="编辑"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(photo)}
                          className="rounded p-1 text-muted-foreground hover:bg-red-900/30 hover:text-red-400 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {photo.description && (
                      <p className="text-muted-foreground text-xs line-clamp-1">
                        {photo.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-muted-foreground/70 text-xs">
                      {summary && <span>{summary}</span>}
                      {size && <span>{size}</span>}
                    </div>

                    {location && (
                      <p className="text-muted-foreground/70 text-xs">{location}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Delete confirmation dialog ──────────── */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              此操作将永久删除「
              <span className="font-medium text-foreground/80">
                {deleteTarget?.title}
              </span>
              」，包括 Cloudflare R2 中的原始图片和缩略图。
              <span className="mt-1 block text-red-400">
                此操作不可撤销。
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  删除中…
                </>
              ) : (
                <>
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  确认删除
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
