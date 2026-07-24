"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Share2, AlertCircle } from "lucide-react";

// ── States ──────────────────────────────────────────

type Status = "loading" | "ready" | "error";
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
  const [status, setStatus] = useState<Status>("loading");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template>("classic");
  const [fadeIn, setFadeIn] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStatus("loading");
      setShareUrl(null);
      setTemplate("classic");
      fetchShareImage("classic");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, photoId]);

  async function fetchShareImage(tpl?: Template) {
    const t = tpl ?? template;
    setStatus("loading");
    setFadeIn(false);
    try {
      const res = await fetch(`/api/photos/${photoId}/share?template=${t}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) throw new Error("Not an image");

      const url = URL.createObjectURL(blob);
      setShareUrl(url);
      setStatus("ready");
      // Trigger fade-in after render
      requestAnimationFrame(() => setFadeIn(true));
    } catch (err) {
      console.error("ShareDialog: fetch failed", err);
      setStatus("error");
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
      <DialogContent className="max-w-xl sm:max-w-[92vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            <span className="truncate">{photoTitle}</span>
          </DialogTitle>
        </DialogHeader>

        {/* ── Template Toggle ──────────────────────────── */}
        <div className="flex justify-center">
          <div
            className={cn(
              "inline-flex rounded-lg bg-muted p-0.5",
              status === "loading" && "pointer-events-none opacity-50",
            )}
          >
            <button
              type="button"
              onClick={() => {
                setTemplate("classic");
                fetchShareImage("classic");
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                template === "classic"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              经典 EXIF
            </button>
            <button
              type="button"
              onClick={() => {
                setTemplate("signature");
                fetchShareImage("signature");
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
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
          {status === "loading" && (
            <div className="flex min-h-[300px] w-full items-center justify-center rounded-xl bg-muted/50">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm">生成分享图中…</span>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-xl bg-muted/50">
              <AlertCircle className="mb-2 h-8 w-8 text-destructive" />
              <p className="mb-1 text-sm text-muted-foreground">生成失败</p>
              <Button variant="outline" size="sm" onClick={() => fetchShareImage(template)}>
                重试
              </Button>
            </div>
          )}

          {status === "ready" && shareUrl && (
            <div className="flex justify-center overflow-hidden rounded-xl bg-muted/50">
              <Image
                src={shareUrl}
                alt={photoTitle}
                width={1440}
                height={0}
                className={cn(
                  "h-auto w-auto max-h-[82svh] max-w-full object-contain",
                  "transition-opacity duration-300 ease-out",
                  fadeIn ? "opacity-100" : "opacity-0",
                )}
                unoptimized
                priority
              />
            </div>
          )}
        </div>

        {/* ── Actions ────────────────────────────── */}
        {status === "ready" && (
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
