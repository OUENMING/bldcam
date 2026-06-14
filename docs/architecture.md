# Architecture

## Overview

camlife-lite is a minimalist personal photography portfolio. Single user (admin), SQLite database, Cloudflare R2 for image storage.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **UI**: Tailwind CSS v4 + shadcn/ui
- **Database**: SQLite via Prisma ORM
- **Storage**: Cloudflare R2 (S3-compatible API via @aws-sdk)
- **Image Processing**: sharp (resize/compress), exifr (EXIF), blurhash (placeholder)
- **Map**: MapLibre GL JS + Supercluster (free, open-source)
- **Auth**: Simple JWT token (jose), single admin

## Directory Structure

```
src/
├── app/
│   ├── (front)/          # Public-facing pages
│   │   ├── layout.tsx    # Front layout (header, theme toggle)
│   │   └── page.tsx      # Homepage gallery
│   ├── admin/            # Admin dashboard
│   │   ├── layout.tsx    # Admin layout (auth guard)
│   │   └── page.tsx      # Upload + manage
│   ├── api/              # API routes
│   │   └── auth/login/   # Token-based login
│   └── layout.tsx        # Root layout (providers)
├── components/
│   ├── ui/               # shadcn/ui components
│   └── gallery/          # Photo display components
├── features/
│   └── map/              # Map feature (Phase 4)
├── lib/
│   ├── prisma.ts         # Prisma singleton
│   ├── r2.ts             # R2 client + helpers
│   ├── auth.ts           # JWT sign/verify
│   └── image/            # Image processing pipeline
│       ├── exif.ts
│       ├── blurhash.ts
│       └── thumbnail.ts
└── types/
    └── photo.ts          # Photo type definitions
```

## Data Flow

### Upload
1. Admin selects photo + enters metadata
2. Browser sends file to API route
3. API extracts EXIF (exifr)
4. API generates thumbnail (sharp)
5. API generates BlurHash
6. API uploads original + thumbnail to R2
7. API saves metadata to SQLite

### Display
1. Front page fetches photos from API
2. Next.js Image loads thumbnails with BlurHash placeholder
3. Click opens lightbox with full image
4. Photo detail shows EXIF data

## Key Decisions

- **SQLite over PostgreSQL**: Single user, zero maintenance, file-based
- **Prisma over Drizzle**: Better documentation for beginners
- **MapLibre over Mapbox**: Free, no API key needed
- **JWT token over Better Auth**: Single admin, no session DB needed
- **Cloudflare R2 only**: One storage provider, no abstraction layer

## Reference

Inspired by [sun0225SUN/camlife](https://github.com/sun0225SUN/camlife). UI patterns and interactions are replicated, but the architecture is built from scratch for simplicity.
