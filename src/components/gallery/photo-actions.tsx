"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Share2, Download, Loader2 } from "lucide-react";
import { ShareDialog } from "@/components/gallery/share-dialog";
import { downloadFile } from "@/lib/download";

interface PhotoActionsProps {
  photoId: string;
  photoTitle: string;
}

export function PhotoActions({
  photoId,
  photoTitle,
}: PhotoActionsProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadFile(`/api/photos/${photoId}/download`, `bldcam-${photoId}.png`);
      toast.success("已保存");
    } catch (err) {
      // The old `<a download>` handed the browser the error page as a file and
      // said nothing; now a failed transcode actually reaches the user.
      toast.error(err instanceof Error ? err.message : "下载失败");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-default disabled:opacity-70"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {downloading ? "下载中…" : "下载原图"}
        </button>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border/50 bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Share2 className="h-4 w-4" />
          生成分享图
        </button>
      </div>
      <ShareDialog
        photoId={photoId}
        photoTitle={photoTitle}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </>
  );
}
