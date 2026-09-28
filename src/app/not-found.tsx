import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  // The root layout's title template appends "· BLDcam"; writing the suffix here
  // too produced "这里没有照片 · BLDcam · BLDcam".
  title: "这里没有照片",
};

/**
 * The global 404 lives outside the `(front)` group, so it does not get the site
 * Header — it carries the wordmark itself instead of depending on layout that
 * only exists on the front routes.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Link href="/" className="inline-flex items-baseline font-heading text-2xl">
        <span className="font-bold tracking-widest text-foreground">BLD</span>
        <span className="font-normal italic tracking-wide text-primary">cam</span>
      </Link>

      {/* max-w-lg rather than a narrower measure: `text-balance` has no notion of
          Chinese word boundaries, so a tight column broke mid-phrase
          ("…也许是链接写 / 错了…"). This width fits the line. */}
      <p className="max-w-lg text-balance text-muted-foreground">
        这条路上没有照片。也许是链接写错了，也许那张已经被删掉了。
      </p>

      <Link
        href="/"
        className="rounded-full bg-primary px-4 py-2 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
      >
        回画廊
      </Link>
    </main>
  );
}
