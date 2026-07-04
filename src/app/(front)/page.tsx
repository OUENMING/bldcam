import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { PhotoGrid } from "@/components/gallery/photo-grid";
import { CitySidebar } from "@/components/layout/city-sidebar";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ city?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = (await searchParams) as Record<string, string | undefined>;
  const city = params.city;
  const category = params.category;

  // ── Total count (all photos, regardless of filters) ──
  const totalCount = await prisma.photo.count();

  // ── Query cities grouped by country + categories ──
  const [cityRows, categoryRows] = await Promise.all([
    prisma.photo.groupBy({
      by: ["country", "city"],
      where: { city: { not: null } },
      _count: { id: true },
      orderBy: [{ country: "asc" }, { _count: { id: "desc" } }],
    }),
    prisma.photo.groupBy({
      by: ["category"],
      where: { category: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);

  // Group cities by country
  const countryMap = new Map<string, { city: string; count: number }[]>();
  cityRows.forEach((r) => {
    if (!r.country || !r.city) return;
    const list = countryMap.get(r.country) ?? [];
    list.push({ city: r.city, count: r._count.id });
    countryMap.set(r.country, list);
  });
  const countryGroups = Array.from(countryMap, ([country, cities]) => ({
    country,
    cities,
  }));

  const categories = categoryRows
    .filter((r) => r.category)
    .map((r) => ({ category: r.category!, count: r._count.id }));

  // ── Build where clause ──────────────────────────
  // Only one active filter at a time (city XOR category).
  // Clicking "全部照片" clears both.
  const filterKey = city
    ? `city:${city}`
    : category
      ? `category:${category}`
      : "all";

  const where =
    city ? { city }
    : category ? { category }
    : {};

  // ── SSR first screen: 20 photos + total count (concurrent) ──
  const [initialPhotos, filteredCount] = await Promise.all([
    prisma.photo.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.photo.count({ where }),
  ]);

  return (
    <div className="flex min-h-screen">
      {/* ── Left sidebar ──────────────────────────── */}
      <Suspense
        fallback={
          <aside className="w-56 shrink-0 border-r border-border/50 bg-background/50" />
        }
      >
        <CitySidebar
          countryGroups={countryGroups}
          categories={categories}
          totalCount={totalCount}
        />
      </Suspense>

      {/* ── Right content ─────────────────────────── */}
      <main className="flex-1 px-4 py-8 md:px-6 md:py-12">
        {initialPhotos.length === 0 ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                {city
                  ? `"${city}" 还没有照片`
                  : category
                    ? `"${category}" 分类还没有照片`
                    : "还没有照片"}
              </p>
              <p className="text-muted-foreground/60 text-sm">
                去后台<a href="/admin" className="underline">上传</a>第一张吧
              </p>
            </div>
          </div>
        ) : (
          <PhotoGrid
            key={filterKey}
            initialPhotos={initialPhotos}
            totalCount={filteredCount}
            city={city}
            category={category}
          />
        )}
      </main>
    </div>
  );
}
