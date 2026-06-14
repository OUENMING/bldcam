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
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-muted-foreground">加载地图中…</p>
      </div>
    ),
  },
);
