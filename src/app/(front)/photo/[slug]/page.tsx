import Image from "next/image";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCamera, formatDate, formatExifLine, formatLocation } from "@/lib/format";
import { PhotoActions } from "@/components/gallery/photo-actions";

interface Props {
  params: Promise<{ slug: string }>;
}

// generateMetadata and the page body need the same record, and the App Router runs
// them as separate calls — without cache() the same slug was queried twice on every
// page view. cache() dedupes within one request.
const getPhotoBySlug = cache(async (slug: string) =>
  prisma.photo.findUnique({ where: { slug } }),
);

// ── generateMetadata (SEO) ─────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);

  if (!photo) {
    return { title: "未找到照片 · BLDcam" };
  }

  const description = [
    photo.title,
    photo.city && `摄于 ${photo.city}`,
    photo.make && photo.model && formatCamera(photo.make, photo.model),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    title: `${photo.title} · BLDcam`,
    description,
    openGraph: {
      title: photo.title,
      description,
      images: [photo.url],
      type: "article",
    },
  };
}

// ── Page ─────────────────────────────────────

export default async function PhotoDetailPage({ params }: Props) {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);

  if (!photo) notFound();

  const location = formatLocation(photo);

  const camera = formatCamera(photo.make, photo.model);
  const exif = formatExifLine(photo);

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-16 sm:px-6 md:py-24">
      {/* ── Back link ─────────────────────── */}
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground/70 transition-colors"
      >
        ← 返回画廊
      </Link>

      {/* ── JSON-LD structured data ─────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Photograph",
            name: photo.title,
            description: photo.description || photo.title,
            image: photo.url,
            thumbnailUrl: photo.thumbnailUrl,
            locationCreated: location
              ? { "@type": "Place", name: location }
              : undefined,
            exifData: [
              { "@type": "PropertyValue", name: "相机", value: camera },
              { "@type": "PropertyValue", name: "参数", value: exif },
              photo.dateTimeOriginal && {
                "@type": "PropertyValue",
                name: "拍摄日期",
                value: new Date(photo.dateTimeOriginal)
                  .toISOString()
                  .split("T")[0],
              },
            ].filter(Boolean),
            dateCreated: photo.dateTimeOriginal?.toISOString(),
            author: { "@type": "Person", name: "菠萝丁 (Owen)" },
            url: `https://bldcam.page/photo/${photo.slug}`,
          })
            // These fields come from the database — upload filenames, EXIF, AI text.
            // A `</script>` in any of them would close the tag, and React does not
            // escape what goes through dangerouslySetInnerHTML.
            .replace(/</g, "\\u003c")
            .replace(/>/g, "\\u003e")
            .replace(/&/g, "\\u0026"),
        }}
      />

      {/* ── Image ────────────────────────── */}
      <div className="relative w-full overflow-hidden rounded-3xl bg-background dark:bg-black md:rounded-[2rem]">
        <Image
          src={photo.url}
          alt={photo.title}
          width={photo.width}
          height={photo.height}
          priority
          blurDataURL={photo.blurDataUrl ?? undefined}
          // `placeholder="blur"` with no data URL throws inside next/image.
          // blurDataUrl is nullable in the schema, so it decides the mode.
          placeholder={photo.blurDataUrl ? "blur" : "empty"}
          className="h-auto w-full"
          sizes="(max-width: 768px) 100vw, 80vw"
        />
      </div>

      {/* ── Info ─────────────────────────── */}
      <div className="mt-8 space-y-4">
        <h1 className="font-semibold text-foreground text-2xl tracking-tight sm:text-3xl">
          {photo.title}
        </h1>

        {photo.description && (
          <p className="text-foreground/60 text-base">{photo.description}</p>
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {camera && (
            <span className="text-muted-foreground">
              <span className="text-muted-foreground/70">相机 </span>
              <span className="text-foreground/70">{camera}</span>
            </span>
          )}
          {photo.lensModel && (
            <span className="text-muted-foreground">
              <span className="text-muted-foreground/70">镜头 </span>
              <span className="text-foreground/70">{photo.lensModel}</span>
            </span>
          )}
          {exif && (
            <span className="text-muted-foreground">
              <span className="text-muted-foreground/70">参数 </span>
              <span className="text-foreground/70">{exif}</span>
            </span>
          )}
          {photo.dateTimeOriginal && (
            <span className="text-muted-foreground">
              <span className="text-muted-foreground/70">拍摄 </span>
              <span className="text-foreground/70">
                {formatDate(new Date(photo.dateTimeOriginal))}
              </span>
            </span>
          )}
        </div>

        {location && (
          <p className="text-muted-foreground text-sm">
            <MapPin className="inline h-4 w-4 -translate-y-px text-muted-foreground" />
            <span className="text-foreground/60">{location}</span>
          </p>
        )}

        {photo.category && (
          <Link
            href={`/?category=${encodeURIComponent(photo.category)}`}
            className="inline-block rounded-full bg-card px-3 py-1 text-xs text-foreground/60 hover:bg-muted transition-colors"
          >
            {photo.category}
          </Link>
        )}

        {/* ── Actions: download + share ────────── */}
        <PhotoActions
          photoId={photo.id}
          photoTitle={photo.title}
        />
      </div>
    </div>
  );
}
