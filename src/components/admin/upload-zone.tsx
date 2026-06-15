"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Upload, X, Check, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Photo } from "@prisma/client";

// ── Types ─────────────────────────────────────────

interface FileEntry {
  id: string;
  file: File;
  title: string;
  description: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  // AI
  category: string | null;
  aiLoading: boolean;
  aiSuggested?: boolean;
}

// ── Helpers ───────────────────────────────────────

let _entryId = 0;
function nextId(): string {
  return `entry-${++_entryId}-${Date.now()}`;
}

function titleFromFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── XMLHttpRequest wrapper ─────────────────────────

function uploadWithProgress(
  formData: FormData,
  onProgress: (pct: number) => void,
): Promise<Photo> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/photos");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          reject(new Error(JSON.parse(xhr.responseText).error));
        } catch {
          reject(new Error("Upload failed"));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(formData);
  });
}

// ── AI suggest helper ─────────────────────────────

async function fetchAiSuggestion(file: File): Promise<{
  suggestedTitle: string | null;
  suggestedCategory: string | null;
}> {
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  try {
    const res = await fetch("/api/photos/suggest", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[AI] HTTP ${res.status} for ${file.name}`);
      return { suggestedTitle: null, suggestedCategory: null };
    }

    const data = await res.json();
    console.log(
      `[AI] ${file.name} → title:"${data.suggestedTitle}" cat:"${data.suggestedCategory}"`,
    );
    return data;
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`[AI] failed for ${file.name}:`, err);
    return { suggestedTitle: null, suggestedCategory: null };
  }
}

// ── Component ──────────────────────────────────────

interface UploadZoneProps {
  onPhotosUploaded: (photos: Photo[]) => void;
}

export function UploadZone({ onPhotosUploaded }: UploadZoneProps) {
  const [queue, setQueue] = useState<FileEntry[]>([]);
  const [batchUploading, setBatchUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // ── AI suggestion (fire-and-forget) ─────────────

  const suggestForEntry = useCallback(async (id: string, file: File) => {
    setQueue((prev) =>
      prev.map((e) => (e.id === id ? { ...e, aiLoading: true } : e)),
    );

    const { suggestedTitle, suggestedCategory } =
      await fetchAiSuggestion(file);

    setQueue((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;

        const defaultName = titleFromFilename(e.file.name);
        const wasDefaultTitle =
          e.title === defaultName || e.title === "";

        return {
          ...e,
          aiLoading: false,
          ...(suggestedTitle && wasDefaultTitle
            ? { title: suggestedTitle, aiSuggested: true }
            : {}),
          ...(suggestedCategory
            ? { category: suggestedCategory }
            : {}),
        };
      }),
    );
  }, []);

  // ── Queue management ───────────────────────────

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const entries: FileEntry[] = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .map((f) => ({
          id: nextId(),
          file: f,
          title: titleFromFilename(f.name),
          description: "",
          status: "pending" as const,
          progress: 0,
          category: null,
          aiLoading: false,
        }));

      if (entries.length === 0) {
        toast.error("请选择图片文件");
        return;
      }

      setQueue((prev) => [...prev, ...entries]);

      // Fire-and-forget AI (serial — one at a time to avoid rate limits)
      (async () => {
        for (const entry of entries) {
          await suggestForEntry(entry.id, entry.file);
        }
      })();
    },
    [suggestForEntry],
  );

  const removeEntry = useCallback((id: string) => {
    setQueue((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateTitle = useCallback((id: string, title: string) => {
    setQueue((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, title, aiSuggested: false } : e,
      ),
    );
  }, []);

  // ── Upload logic ───────────────────────────────

  const uploadAll = useCallback(async () => {
    const pending = queue.filter(
      (e) => e.status === "pending" || e.status === "error",
    );
    if (pending.length === 0) {
      toast.error("没有待上传的文件");
      return;
    }

    setBatchUploading(true);
    const uploaded: Photo[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const entry of pending) {
      setQueue((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, status: "uploading" as const, progress: 0 }
            : e,
        ),
      );

      const formData = new FormData();
      formData.append("file", entry.file);
      formData.append(
        "title",
        entry.title.trim() || titleFromFilename(entry.file.name),
      );
      formData.append("description", entry.description.trim());
      if (entry.category) {
        formData.append("category", entry.category);
      }

      try {
        const photo = await uploadWithProgress(formData, (pct) => {
          setQueue((prev) =>
            prev.map((e) =>
              e.id === entry.id ? { ...e, progress: pct } : e,
            ),
          );
        });

        setQueue((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? { ...e, status: "done" as const, progress: 100 }
              : e,
          ),
        );
        uploaded.push(photo);
        successCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "上传失败";
        setQueue((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? { ...e, status: "error" as const, error: message }
              : e,
          ),
        );
        failCount++;
      }
    }

    setBatchUploading(false);

    if (failCount === 0) {
      toast.success(`全部 ${successCount} 张照片上传成功`);
    } else if (successCount > 0) {
      toast.warning(`${successCount} 张成功，${failCount} 张失败`);
    } else {
      toast.error(`全部 ${failCount} 张上传失败`);
    }

    if (uploaded.length > 0) {
      onPhotosUploaded(uploaded);
    }
  }, [queue, onPhotosUploaded]);

  // ── Drag & drop ────────────────────────────────

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  }

  const pendingCount = queue.filter(
    (e) => e.status === "pending" || e.status === "error",
  ).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* ── Drop zone ─────────────────────────── */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors duration-200",
          dragOver
            ? "border-amber-500/50 bg-amber-500/5"
            : "border-zinc-800 hover:border-zinc-600",
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="mb-3 h-8 w-8 text-zinc-500" />
        <p className="text-zinc-400 text-sm">
          拖拽多张照片至此，或点击浏览
        </p>
        <p className="mt-1 text-zinc-500 text-xs">
          支持 JPG / PNG / WebP / TIFF · AI 自动起名
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* ── File queue ────────────────────────── */}
      {queue.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium text-zinc-300 text-sm">
              上传队列 ({queue.length})
            </p>
            {!batchUploading && (
              <button
                type="button"
                onClick={() => setQueue([])}
                className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors"
              >
                清空
              </button>
            )}
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {queue.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                  entry.status === "done"
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : entry.status === "error"
                      ? "border-red-500/20 bg-red-500/5"
                      : "border-zinc-800 bg-zinc-900/50",
                )}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {entry.status === "uploading" && (
                    <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                  )}
                  {entry.status === "done" && (
                    <Check className="h-4 w-4 text-emerald-400" />
                  )}
                  {entry.status === "error" && (
                    <AlertCircle className="h-4 w-4 text-red-400" />
                  )}
                  {entry.status === "pending" && entry.aiLoading && (
                    <Sparkles className="h-4 w-4 animate-pulse text-purple-400" />
                  )}
                  {entry.status === "pending" && !entry.aiLoading && (
                    <div className="h-4 w-4 rounded-full border-2 border-zinc-600" />
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Input
                      value={entry.title}
                      onChange={(e) => updateTitle(entry.id, e.target.value)}
                      disabled={batchUploading || entry.status === "done"}
                      placeholder="标题"
                      className={cn(
                        "h-6 flex-1 min-w-0 border-0 bg-transparent px-0 font-medium text-sm placeholder:text-zinc-600 focus-visible:ring-0",
                        entry.aiSuggested &&
                          entry.status === "pending" &&
                          "text-purple-300",
                        entry.status !== "pending" && "text-zinc-200",
                      )}
                    />
                    {entry.aiSuggested && entry.status === "pending" && (
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-purple-400" />
                    )}
                    <span className="shrink-0 text-zinc-600 text-xs">
                      {formatSize(entry.file.size)}
                    </span>
                  </div>
                  <p className="truncate text-zinc-500 text-xs">
                    {entry.file.name}
                    {entry.aiLoading && (
                      <span className="ml-1.5 inline-flex items-center text-purple-400">
                        <Sparkles className="mr-0.5 h-3 w-3" />
                        AI 分析中…
                      </span>
                    )}
                    {entry.category &&
                      entry.status === "pending" &&
                      !entry.aiLoading && (
                        <span className="ml-1.5 text-zinc-600">
                          · {entry.category}
                        </span>
                      )}
                  </p>

                  {entry.status === "uploading" && (
                    <Progress value={entry.progress} className="mt-1.5 h-1" />
                  )}

                  {entry.status === "error" && entry.error && (
                    <p className="mt-1 text-red-400 text-xs">
                      {entry.error}
                    </p>
                  )}
                </div>

                {!batchUploading && entry.status !== "uploading" && (
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    className="shrink-0 rounded p-0.5 text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {pendingCount > 0 && (
            <Button
              onClick={uploadAll}
              disabled={batchUploading}
              className="w-full"
            >
              {batchUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  上传中…
                </>
              ) : (
                `上传全部 (${pendingCount})`
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
