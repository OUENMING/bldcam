"use client";

import dynamic from "next/dynamic";
import type { Photo } from "@prisma/client";

type MapPhoto = Pick<
  Photo,
  | "id" | "title" | "thumbnailUrl" | "url"
  | "latitude" | "longitude"
  | "city" | "region" | "country"
  | "fNumber" | "focalLength35mm" | "iso" | "exposureTime"
  | "dateTimeOriginal" | "width" | "height"
>;

export const PhotoMap = dynamic<{ photos: MapPhoto[] }>(
  () =>
    import("@/features/map/photo-map").then((m) => ({ default: m.PhotoMap })),
  {
    ssr: false,
    loading: () => (
      // Same box as photo-map itself. `100vh` here against the map's `100svh` minus
      // safe-area insets meant the page jumped by the height of the mobile browser
      // chrome the moment the map took over the slot.
      <div
        className="flex items-center justify-center"
        style={{
          height:
            "calc(100svh - 4rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
        }}
      >
        <p className="text-muted-foreground">加载地图中…</p>
      </div>
    ),
  },
);
