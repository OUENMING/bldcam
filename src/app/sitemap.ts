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

  // Dynamic photo detail pages.
  // A database hiccup used to turn the whole response into a 500, which reads to a
  // crawler as the site being down. Serving the static routes is strictly better,
  // and the protocol caps one sitemap file at 50,000 URLs anyway.
  let photos: { slug: string | null; updatedAt: Date }[] = [];
  try {
    photos = await prisma.photo.findMany({
      where: { slug: { not: null } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 50_000,
    });
  } catch (error) {
    console.error("sitemap: photo query failed, serving static routes only:", error);
  }

  const photoRoutes: MetadataRoute.Sitemap = photos.map((photo) => ({
    url: `${baseUrl}/photo/${photo.slug}`,
    lastModified: photo.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.9,
  }));

  return [...staticRoutes, ...photoRoutes];
}
