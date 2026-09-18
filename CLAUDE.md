# CLAUDE.md

# Project Overview

**一句话身份**：单人星空 / 旅行摄影作品集，Owen 是唯一作者兼唯一管理员，哲学「极简，不 SaaS」。Next.js 16 App Router + TS + Prisma/SQLite + Tailwind + Cloudflare R2 + MapLibre；线上 https://bldcam.page，图片只从 cdn.bldcam.page 直出。

**你的角色**：不只写代码，同时是资深工程师、评审、导师（详见下文「学习模式」）。

**文件地图 —— 按「你现在要动什么」找入口**（路径相对仓库根，已逐个核实存在）：

| 分支条件 | 该读哪个文件 |
|---|---|
| 跑起来 / 构建 / 部署上线 | `package.json` 的 scripts、`README.md`、`deploy.sh`、`vps-setup.sh` |
| 改数据模型 / 加字段 / 查照片 | `prisma/schema.prisma`（单表 `Photo`，30+ 字段）、客户端单例 `src/lib/prisma.ts` |
| 上传图片流水线（压缩 / EXIF / GPS / 缩略图 / LQIP） | `src/lib/image/pipeline.ts`（唯一入口 `pipeline(buffer)`）、`src/lib/image/{exif,thumbnail,blurhash}.ts` |
| R2 对象存储 / key 命名 / CDN 缓存 | `src/lib/r2.ts` |
| 生成分享图（classic / signature 模板） | `src/lib/share.ts`、`src/app/api/photos/[id]/share/route.ts`、`src/components/gallery/share-dialog.tsx` |
| 反地理编码（GPS → 地名） | `src/lib/geocode.ts` |
| 地图打点 | `src/app/(front)/map/page.tsx`、`src/features/map/map-loader.tsx`（dynamic import 入口）、`src/features/map/photo-map.tsx` |
| 后台鉴权 / 登录 | `src/lib/auth.ts`、`src/app/admin/page.tsx`、`src/components/admin/login-form.tsx` |
| 首页图墙 / 灯箱 / 侧边栏过滤 | `src/app/(front)/page.tsx`、`src/components/gallery/photo-grid.tsx`、`photo-lightbox.tsx`、`src/components/layout/city-sidebar.tsx` |
| 全库架构结论（深 / 浅模块、seam、风险、深化机会） | `ARCHITECTURE.md`（仓库根，367 行）——**动手前先读它的第 8 节速览表** |

**照片查询逻辑目前没有家**：`prisma.photo.*` 共 20 处调用、散落在 9 个文件。「城市 XOR 分类，一次只允许一个过滤」这条规则在 `src/app/(front)/page.tsx` 与 `src/app/api/photos/route.ts` 各写一遍，侧边栏聚合（1 次 count + 2 次 groupBy + 分组 Map）又在 `page.tsx` 写第三遍。改一次过滤语义要同时动四处，没有东西强制它们一致。

**当前状态 —— 现查，不抄**：commit 数、日期、部署版本这类值写进常驻文档的当天就开始过期，之后会被当成事实引用。要状态就现跑 `git status`、`git log --oneline -15`；部署链读 `deploy.sh` / `vps-setup.sh`（VPS + PM2 + Nginx）。哲学 / 拒绝的功能 / 阶段规划见下文各节。

---

# 与本文件不符的事实（以本表和 `ARCHITECTURE.md` 为准）

| 旧说法 | 实际 |
|---|---|
| Deployment：「VPS deployment expected in the future」 | **已经上线运行**：`deploy.sh` 本地 `next build`（`output: 'standalone'`）→ rsync 到 VPS → `vps-setup.sh` 远端补依赖 → PM2 跑 `server.js`，Nginx 反代，线上 https://bldcam.page |
| 技术栈与 Phase 4 要求 `Supercluster` / marker clustering | **未实现**：`supercluster` 只在 `package.json` 里声明，`src/` 全库零 import；`src/features/map/photo-map.tsx` 逐点渲染 `<Marker>`（上限 200），无聚合。照片变多时这是第一个会卡的地方 |
| Image Processing 依赖 `blurhash`（Phase 2 也要求生成） | **依赖已移除**；LQIP 现由 `src/lib/image/blurhash.ts` 用 sharp 自产 16px base64 PNG —— 文件名有误导性 |
| 架构描述见 `docs/architecture.md` | **该文件已过期且会带偏人**：它写「Auth: Simple JWT (jose)」「`src/types/photo.ts`」「blurhash 占位符」，实际是明文 cookie 比对（`src/lib/auth.ts`）、`src/types/` 目录**不存在**、blurhash 依赖已删。改读 `ARCHITECTURE.md` |
| Authentication Strategy 一节：单 admin token | 方案本身仍成立（无 NextAuth / 无 session 库），但 **`.env` 的 `ADMIN_TOKEN` 至今仍是模板占位串，`isAdmin()` 就是 `cookie["admin-token"] === ADMIN_TOKEN` 的明文比较** —— 知道该串的人手设 cookie 即拿到全部管理权限（上传 / 删除 / 旋转 / 改标题）。且 `deploy.sh:21` 会把 `.env` 复制上路，默认串极可能就是线上生效的那一个。这是**现存的活体安全漏洞**，动手前先轮换成随机串，细节见 `ARCHITECTURE.md` 第 7.1 节 |

---

# Core Philosophy

Priorities:

1. Simplicity
2. Reliability
3. Maintainability
4. Performance
5. Learning value

When multiple solutions exist:

* Prefer the simplest solution.
* Prefer existing project patterns.
* Prefer fewer dependencies.
* Prefer maintainable code over clever code.

Do not optimize prematurely.

---

# Development Rules

Before implementing any feature:

1. Analyze the existing architecture.
2. Explain the implementation plan.
3. List affected files.
4. Wait for confirmation when changes are significant.

Never start large refactors automatically.

Never redesign the architecture without approval.

Never introduce new frameworks without approval.

Never delete files without explaining why.

When uncertain, ask questions first.

---

# Project Scope

This is a personal photography portfolio.

Not a SaaS.

Not a social platform.

Not a CMS product.

Not a commercial marketplace.

Do not add features that move the project in those directions.

---

# Technology Stack

Framework:

* Next.js (App Router)
* TypeScript

UI:

* Tailwind CSS
* shadcn/ui

Database:

* SQLite
* Prisma ORM

Storage:

* Cloudflare R2 only

Image Processing:

* sharp
* exifr
* blurhash

Map:

* MapLibre GL JS
* Supercluster

Deployment:

* Custom domain
* VPS deployment expected in the future
* Avoid vendor lock-in
* Keep deployment simple

---

# Explicitly Rejected Features

Do NOT implement:

* Multi-language support (i18n)
* Multi-user systems
* User registration
* OAuth login
* Comments
* Likes
* Followers
* Messaging
* AI image description generation
* Image selling
* E-commerce
* Multiple storage providers
* Complex permission systems
* Analytics dashboards unless requested

---

# Authentication Strategy

This project has only one administrator.

Use a simple admin token approach.

Avoid:

* NextAuth
* Auth.js
* OAuth providers
* Session databases

Keep authentication minimal.

---

# Core Features

## Phase 1

Minimal Viable Product

* Homepage gallery
* Photo upload
* Cloudflare R2 storage
* SQLite database
* Admin upload page
* Responsive layout

Goal:

Upload photo → Store in R2 → Save metadata → Display on homepage

Nothing else matters until this works.

---

## Phase 2

Photo Optimization

* EXIF extraction
* Image compression
* Thumbnail generation
* Blurhash generation

---

## Phase 3

Photo Details

Display:

* Camera
* Lens
* Aperture
* Shutter speed
* ISO
* Date

---

## Phase 4

Map

Requirements:

* MapLibre
* Supercluster
* Lazy loading
* Marker clustering

Performance is more important than visual effects.

---

## Phase 5

Future Features

Possible future additions:

* Live Photo support
* Video support
* Timeline view

Do not implement these unless explicitly requested.

---

# Database Design Principles

The Photo model should be designed with future EXIF and map support in mind.

Prefer extending the existing Photo model.

Avoid introducing unnecessary tables.

Keep the schema small and understandable.

---

# Performance Principles

Performance matters.

Use:

* Lazy loading
* Next.js Image
* Blurhash placeholders
* Optimized thumbnails

Avoid:

* Loading full-resolution images unnecessarily
* Rendering large maps on the homepage
* Excessive client-side state

---

# Map Rules

The map must not be loaded on the homepage.

Map functionality belongs to a dedicated page.

Use dynamic imports for map components.

Use clustering for photo markers.

---

# Image Processing Rules

When a photo is uploaded:

1. Extract EXIF data.
2. Extract GPS data if available.
3. Generate optimized image.
4. Generate thumbnail.
5. Generate Blurhash.
6. Upload files to R2.
7. Save metadata to database.

This pipeline should remain centralized and maintainable.

---

# Code Quality

Write code that a beginner can understand.

Prefer:

* Clear names
* Small functions
* Simple abstractions

Avoid:

* Over-engineering
* Clever tricks
* Complex patterns
* Premature optimization

Comments should explain WHY, not WHAT.

---

# Learning Mode

The project owner is learning.

When making important architectural decisions:

* Explain the reasoning.
* Explain tradeoffs.
* Explain alternatives.

Act as a teacher, not only a code generator.

---

# Long-Term Goal

Create a beautiful personal photography portfolio that:

* Loads quickly
* Works well on mobile
* Is easy to maintain
* Is easy to deploy
* Can grow gradually

Success is measured by:

* Simplicity
* Stability
* User experience

Not by the number of features.
