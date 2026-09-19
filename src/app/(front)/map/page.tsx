import { prisma } from "@/lib/prisma";
import { PhotoMap } from "@/features/map/map-loader";

export const dynamic = "force-dynamic";

/** Pins drawn at once. Markers are not clustered, so this is also the point past
 *  which the map starts to feel heavy. */
const MAP_PIN_LIMIT = 200;

export default async function MapPage() {
  const photos = await prisma.photo.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
    },
    take: MAP_PIN_LIMIT,
    select: {
      id: true,
      title: true,
      thumbnailUrl: true,
      url: true,
      latitude: true,
      longitude: true,
      city: true,
      region: true,
      country: true,
      fNumber: true,
      focalLength35mm: true,
      iso: true,
      exposureTime: true,
      dateTimeOriginal: true,
      width: true,
      height: true,
    },
    orderBy: { dateTimeOriginal: "desc" },
  });

  return <PhotoMap photos={photos} />;
}
