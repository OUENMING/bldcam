"use client";

import { useState } from "react";
import { Share2, Download } from "lucide-react";
import { ShareDialog } from "@/components/gallery/share-dialog";

interface PhotoActionsProps {
  photoId: string;
  photoTitle: string;
}

export function PhotoActions({
  photoId,
  photoTitle,
}: PhotoActionsProps) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`/api/photos/${photoId}/download`}
          download
          className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Download className="h-4 w-4" />
          下载原图
        </a>
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
