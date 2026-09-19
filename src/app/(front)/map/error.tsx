"use client";

import { Button } from "@/components/ui/button";

/**
 * Route-level boundary for /map.
 *
 * The map is a client-only dynamic import, so its chunk arrives after the page has
 * already rendered. When that chunk fails — flaky network, or a stale chunk URL
 * after a deploy — nothing used to catch it and the loading state simply stayed on
 * screen for good, with no message and no way out.
 */
export default function MapError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 px-6 text-center"
      style={{
        height:
          "calc(100svh - 4rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
      }}
    >
      <p className="text-muted-foreground">地图加载失败</p>
      <p className="text-muted-foreground/70 text-sm">
        可能是网络不稳，或页面刚更新过。重试一次通常就好了。
      </p>
      <Button variant="outline" onClick={reset} className="mt-1 rounded-full">
        重试
      </Button>
    </div>
  );
}
