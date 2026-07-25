"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Share2, AlertCircle } from "lucide-react";

// ── Helpers ──────────────────────────────────────────

function revoke(url: string | null) {
  if (url) URL.revokeObjectURL(url);
}

// ── Types ────────────────────────────────────────────

type Template = "classic" | "signature";

interface ShareDialogProps {
  photoId: string;
  photoTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Component ──────────────────────────────────────

export function ShareDialog({
  photoId,
  photoTitle,
  open,
  onOpenChange,
}: ShareDialogProps) {
  // Core state: image + template are always set together and never stale
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template>("classic");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [fadeIn, setFadeIn] = useState(false);

  // When we have an image and are loading the next one, this overlay appears
  const [switching, setSwitching] = useState(false);

  const blobRef = useRef<string | null>(null);
  const seqRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => revoke(blobRef.current);
  }, []);

  // Dialog open → fetch the initial template
  useEffect(() => {
    if (!open) return;
    // Full reset
    setStatus("loading");
    setShareUrl(null);
    setTemplate("classic");
    setFadeIn(false);
    setSwitching(false);
    revoke(blobRef.current);
    blobRef.current = null;
    fetchShareImage("classic");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, photoId]);

  async function fetchShareImage(tpl: Template) {
    const seq = ++seqRef.current;

    // Mark loading — but DON'T hide the existing image (stale-while-loading)
    const isSwitch = status === "ready" && shareUrl != null;
    if (isSwitch) {
      setSwitching(true);
    } else {
      setStatus("loading");
    }

    try {
      const res = await fetch(
        `/api/photos/${photoId}/share?template=${tpl}`,
      );
      if (seq !== seqRef.current) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      if (seq !== seqRef.current) return;
      if (!blob.type.startsWith("image/")) throw new Error("Not an image");

      const url = URL.createObjectURL(blob);
      revoke(blobRef.current);
      blobRef.current = url;

      if (seq !== seqRef.current) {
        revoke(url);
        blobRef.current = null;
        return;
      }

      // Swap in the new image
      setShareUrl(url);
      setTemplate(tpl);
      setSwitching(false);
      setStatus("ready");
      // Force layout before triggering fade-in to ensure the browser has
      // committed the new src. Without rAF, opacity transitions on a freshly
      // mounted element may start from opacity-0 instead of the target.
      requestAnimationFrame(() => requestAnimationFrame(() => setFadeIn(true)));
    } catch (err) {
      if (seq !== seqRef.current) return;
      console.error("ShareDialog: fetch failed", err);
      setStatus("error");
      setSwitching(false);
    }
  }

  const handleDownload = useCallback(() => {
    if (!shareUrl) return;
    const a = document.createElement("a");
    a.href = shareUrl;
    a.download = `bldcam-${photoId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("已保存");
  }, [shareUrl, photoId]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/api/photos/${photoId}/share?template=${template}`,
      );
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败");
    }
  }, [photoId, template]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-[92vw] z-[10001]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" aria-hidden="true" />
            <span className="truncate">{photoTitle}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            选择经典 EXIF 或艺术签名模板，预览并下载分享图
          </DialogDescription>
        </DialogHeader>

        {/* ── Template Toggle ──────────────────────────── */}
        <div className="flex justify-center">
          <div
            className={cn(
              "inline-flex rounded-lg bg-muted p-0.5",
              (status === "loading" || switching) && "pointer-events-none opacity-50",
            )}
            role="radiogroup"
            aria-label="分享图模板"
          >
            <button
              type="button"
              role="radio"
              aria-checked={template === "classic"}
              onClick={() => fetchShareImage("classic")}
              className={cn(
                "rounded-md px-4 py-2.5 text-sm font-medium transition-colors duration-200",
                template === "classic"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              经典 EXIF
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={template === "signature"}
              onClick={() => fetchShareImage("signature")}
              className={cn(
                "rounded-md px-4 py-2.5 text-sm font-medium transition-colors duration-200",
                template === "signature"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              艺术签名
            </button>
          </div>
        </div>

        {/* ── Content ───────────────────────────── */}
        <div className="flex flex-col items-center gap-4">
          {/* Initial loading — no cached image yet */}
          {status === "loading" && !shareUrl && (
            <div className="flex min-h-[300px] w-full items-center justify-center rounded-xl bg-muted/50">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm">生成分享图中…</span>
              </div>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-xl bg-muted/50">
              <AlertCircle className="mb-2 h-8 w-8 text-destructive" />
              <p className="mb-1 text-sm text-muted-foreground">生成失败</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchShareImage(template)}
              >
                重试
              </Button>
            </div>
          )}

          {/* Image — visible during "ready" AND during template switches.
              Uses position:relative so the loading overlay can anchor on it. */}
          {(status === "ready" || (switching && shareUrl)) && shareUrl && (
            <div className="relative flex w-full justify-center overflow-hidden rounded-xl bg-muted/50">
              <Image
                src={shareUrl}
                alt={`${photoTitle} — ${template === "classic" ? "经典 EXIF" : "艺术签名"} 分享图`}
                width={1440}
                height={900}
                className={cn(
                  "h-auto w-auto max-h-[82svh] max-w-full object-contain",
                  "transition-opacity duration-300 ease-out",
                  fadeIn ? "opacity-100" : "opacity-0",
                )}
                unoptimized
                priority
              />

              {/* Switching overlay — subtle spinner on top of the old image */}
              {switching && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm transition-opacity duration-200">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-foreground/70" />
                    <span className="text-xs text-foreground/60">
                      {template === "classic" ? "正在加载签名…" : "正在加载经典…"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Actions ────────────────────────────── */}
        {status === "ready" && !switching && (
          <div className="flex items-center justify-center gap-3">
            <Button onClick={handleDownload}>
              <Download className="mr-1.5 h-4 w-4" />
              下载 PNG
            </Button>
            <Button variant="outline" onClick={handleCopyLink}>
              复制链接
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
