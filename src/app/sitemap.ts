import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://bldcam.page";

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/map`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  // Dynamic photo detail pages
  const photos = await prisma.photo.findMany({
    where: { slug: { not: null } },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const photoRoutes: MetadataRoute.Sitemap = photos.map((photo) => ({
    url: `${baseUrl}/photo/${photo.slug}`,
    lastModified: photo.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.9,
  }));

  return [...staticRoutes, ...photoRoutes];
}
