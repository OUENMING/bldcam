# camlife-lite 架构审查

> 审查对象：`/Users/owen/camlife-lite`（repo `OUENMING/bldcam`，部署于 https://bldcam.page，图片走 https://cdn.bldcam.page）
> 审查基准日期：2026-09-18 · 最后一次提交：2026-08-06（`bb5dc6c8`）· 61 commits · 工作区干净
> 判定标准：项目自述哲学「极简，不 SaaS」+ `CLAUDE.md` 的 5 条优先级（简单 > 可靠 > 可维护 > 性能 > 学习价值）
> 术语：**模块 module / 接口 interface / 深度 depth / seam / adapter / leverage / locality**，全文按此词汇表使用。

---

## 1. 这是什么

一个**单人星空与旅行摄影作品集网站**。作者是唯一的作者与唯一的管理员（Owen，外号「菠萝丁」），域名 `bldcam.page`。

它做四件事，别的一概不做：

1. **展示**：首页瀑布流 / 单列流两种视图浏览照片，按城市（国家分组）或 AI 分类过滤，无限滚动翻页，灯箱看大图 + EXIF。
2. **上传**：唯一的管理员在 `/admin` 拖拽上传，服务端自动跑图片流水线（压缩 → EXIF → GPS 反查 → 缩略图 → LQIP → R2），AI（火山引擎豆包）给标题和 10 类分类建议。
3. **分发**：每张照片可下载 PNG、可生成两种模板的「分享图」（经典 EXIF / 艺术签名），并带 JSON-LD 结构化数据和 sitemap 供搜索引擎收录。
4. **地图**：`/map` 用 MapLibre 3D 地球把带 GPS 的照片打点。

**受众**：主要是作者本人（作品集 + 简历物料），其次是搜索引擎爬虫和收到分享图链接的人。**没有**多用户、评论、点赞、电商、i18n —— 这些在 `CLAUDE.md` 里被显式列为「拒绝实现」。

**规模**：`src/` 下 44 个源文件、约 4700 行（不含 `components/ui/` 的 shadcn 生成件）。这是一个**小代码库**，所以本文的结论不是「哪里太复杂」，而是「哪几处概念没有归位」。

---

## 2. 技术栈与框架

| 维度 | 选择 | 证据 |
|---|---|---|
| 框架 | Next.js **16.2.9**，**App Router**，React 19.2.4 | `package.json`；页面在 `src/app/**/page.tsx` |
| 语言 | TypeScript 5，`strict: true`，路径别名 `@/*` → `./src/*` | `tsconfig.json` |
| 渲染策略 | **全动态**。公开页面无 ISR / 无 `revalidate`；首页、map、sitemap 显式 `export const dynamic = "force-dynamic"` | `src/app/(front)/page.tsx:6`、`src/app/(front)/map/page.tsx:4`、`src/app/sitemap.ts:4`；全库 grep 无 `revalidate` / `unstable_cache` |
| 构建产物 | `output: 'standalone'` → 本地 macOS 构建，rsync 到 VPS 用 PM2 跑 `server.js` | `next.config.ts:4`、`deploy.sh:16-17`、`vps-setup.sh:38` |
| 图片 | `images.unoptimized: true` —— **绕过 Next.js 图片优化器**，`<Image>` 只是直连 R2/CDN 的 `<img>` 包装；root layout 有 `preconnect` 到 CDN | `next.config.ts:6`、`src/app/layout.tsx:75` |
| 数据层 | **Prisma 6.19** + **SQLite**（单文件 `dev.db`，本地 `prisma/dev.db`，VPS `/home/bldcam/dev.db`）。单表 `Photo`，30+ 字段（EXIF + 地理位置 + AI 元数据 + SEO slug） | `prisma/schema.prisma`；无 `migrations/` 目录（早期用 `db push` 类工作流，未确认） |
| 存储 | **Cloudflare R2**（S3 兼容 API，`@aws-sdk/client-s3`），Custom Domain = `cdn.bldcam.page`，对象带 `max-age=31536000, immutable` | `src/lib/r2.ts:39-62`、`.env` 的 `R2_PUBLIC_URL` |
| 图片处理 | `sharp`（resize / webp / 合成）+ `exifr`（EXIF）+ 自写 sharp 版 LQIP（**不是** blurhash 库） | `src/lib/image/*.ts`、`src/lib/share.ts` |
| 地图 | MapLibre GL + `react-map-gl`，`projection="globe"`，底图用 CARTO 公共 style | `src/features/map/photo-map.tsx:132-143` |
| UI | Tailwind v4 + shadcn/ui（base-nova）+ lucide + sonner + yet-another-react-lightbox | `components.json`、`src/components/ui/*` |
| 认证 | **无框架**：单一 `ADMIN_TOKEN` 明文 cookie，服务端字符串比较 | `src/lib/auth.ts` |
| 部署 | 自建 VPS + PM2 + Nginx；`deploy.sh` 本地构建 → `deploy-dist/` → rsync → 远端 `vps-setup.sh` 打补丁 | `deploy.sh`、`vps-setup.sh` |
| 依赖卫生 | `supercluster`、`@base-ui/react`、`zod`、`openai` 声明了但 **`src/` 里未使用** | 全库 grep `supercluster` 无命中 |

> **文档漂移警告**：`docs/architecture.md` 已过期且会误导人 —— 它写「Auth: Simple JWT token (jose)」「`src/types/photo.ts`」「blurhash（占位符）」，但实际是明文 cookie 比对（`auth.ts`）、`src/types/` **目录不存在**、blurhash 依赖已在提交 `0ce974ee` 中移除。任何 agent 读它都会被带偏。建议要么更新，要么在文件头标注作废。

---

## 3. 数据流与代码逻辑

### 3.1 一次「照片详情页」请求的完整路径

```
浏览器 GET /photo/<slug>
  │
  ├─ Next.js App Router 文件路由匹配 src/app/(front)/photo/[slug]/page.tsx
  │    （上一级 `(front)` 是 route group，不产生 URL 段；layout 注入 Header + ViewModeProvider）
  │
  ├─ [1] generateMetadata(params)            photo/[slug]/page.tsx:16-42
  │      └─ prisma.photo.findUnique({ where: { slug } })       :18
  │
  ├─ [2] PhotoDetailPage(params)             photo/[slug]/page.tsx:46-177
  │      ├─ const { slug } = await params                       :47   ← Next 16 起 params 是 Promise
  │      ├─ prisma.photo.findUnique({ where: { slug } })        :48   ← ⚠ 同一请求内第 2 次相同查询
  │      │    （Prisma 调用不会被 Next.js 自动去重，只有 fetch 会；这里没包 React cache()）
  │      ├─ notFound() 若 null                                  :50
  │      └─ 渲染（RSC，纯服务端）：
  │           ├─ JSON-LD <script type="application/ld+json">    :68-97  （@type: Photograph + exifData）
  │           ├─ <Image src={photo.url} … placeholder="blur" …> :101-111
  │           └─ formatCamera / formatExifLine / formatLocation（来自 lib/format.ts）
  │
  └─ [3] 图片投递（关键：图片不经过本应用服务器）
         next/image + images.unoptimized=true  →  浏览器直接 GET https://cdn.bldcam.page/photos/YYYY/MM/<uuid>.webp
         Cloudflare Edge（R2 Custom Domain）命中即回，未命中回源 R2 桶
```

**要点**：详情页加载的是 `photo.url`（2000px 优化版），**不是** `thumbnailUrl`；因为 `unoptimized`，`sizes` 属性实际不起作用，没有 srcset。「图片从 CDN 直出、应用只发 URL」是这个项目性能上最正确的决定，也是它「极简」哲学的兑现。

### 3.2 一次「上传」的完整路径

```
/admin（RSC）→ isAdmin() 否则渲染 LoginForm     src/app/admin/page.tsx:7-16
  │ 登录：POST /api/auth/login {password} → 比对 ADMIN_PASSWORD → setAdminCookie() 写 admin-token cookie
  │
  └─ UploadZone（client）  逐张串行：
       ├─ 立即 POST /api/photos/suggest（fire-and-forget，AI 起名/分类）  upload-zone.tsx:101
       └─ XHR POST /api/photos（multipart: file/title/description/category）  upload-zone.tsx:55
            └─ guard() → isAdmin()                                     api/photos/route.ts:9-13, 59
                 ├─ pipeline(buffer)                                   api/photos/route.ts:88
                 │    src/lib/image/pipeline.ts
                 │      ├─ 并行：processImage(sharp 2000px webp q90 + 800px thumb) ‖ extractExif(exifr) ‖ generateBlurDataURL(16px png)
                 │      ├─ 若有 GPS → reverseGeocode(lat,lng)  (BigDataCloud → Nominatim 顺序回退)
                 │      └─ 上传 2 个对象到 R2，key = photos|thumbnails/YYYY/MM/<uuid>.webp
                 │           失败则 deleteFromR2 回滚，返回 uploadedKeys
                 └─ prisma.photo.create({ ..., slug: generateSlug(title) })  api/photos/route.ts:94-131
                      失败则 deleteFromR2(uploadedKeys) 兜底                        :135-137
```

### 3.3 分享图路径（全库最复杂的一条，也是改动最频繁的）

```
ShareDialog（client）→ fetch /api/photos/<id>/share?template=classic|signature
  └─ GET api/photos/[id]/share/route.ts:20
       ├─ 校验 template ∈ {classic, signature}                        :30
       ├─ prisma.photo.findUnique({where:{id}})                       :37
       ├─ R2 缓存探测：fetch(shareUrl, { method: "HEAD" })            :46  ← 见 5.3
       │    命中 → Accept: image/* 则 307 跳 CDN；否则服务端代理回 PNG  :50-68
       ├─ 未命中 → fetch(photo.url) 取原图                            :76
       ├─ generateShareImage(photo, srcBuf, undefined, template)      :86   src/lib/share.ts:547
       │    背景模糊 → 色调叠加 → 三层 feDropShadow → 圆角照片卡 → 文字/签名 SVG → composite
       └─ 异步回写 R2 缓存（不阻塞响应）                                :89
```

分享图的 key 是**确定性**的：`share/{photoId}/{template}-v12.png`（`src/lib/r2.ts:85-87`）。`v12` 是手工维护的版本号。

---

## 4. 架构：模块 · 接口 · 深度

### 4.1 深模块（接口小、实现厚 —— 项目的资产）

**① `src/lib/image/pipeline.ts` —— 全库最干净的深模块**
- **接口**：`pipeline(buffer: Buffer): Promise<PipelineResult>`。一个入参、一个结构化返回（url / thumbUrl / blurDataURL / 尺寸 / exif / location / uploadedKeys）。
- **实现**：并行编排 3 个处理器 + 条件地理编码 + 2 次 R2 上传 + 失败回滚。
- **深度**：**深**。调用方（上传 route）只需知道「给 Buffer，拿结果」，6 步流水线、超时、回滚、失败语义全部藏在里面。
- **locality**：上传流程的改动 100% 落在这一个文件。**leverage**：删除测试 —— 删掉它，`Promise.all` 编排 + 上传 + 回滚会在 route 里原地重建。**它挣到了自己的位置。**

**② `src/lib/share.ts` —— 最大的深模块（587 行）**
- **接口**：`generateShareImage(photo, imageBuffer, theme = CLASSIC_THEME, template): Promise<ShareResult>`。
- **实现**：`computeLayout` → `renderBackground` → `renderOverlay` → `renderPhoto`（含 squircle 圆角 + `feDropShadow` 三层光学阴影）→ `renderTypography` / `renderSignature`（含 `isFooterAreaDark` 自适应配色）→ `renderComposite`。全部视觉常量集中在 `CLASSIC_THEME`（`share.ts:19-118`），注释明确要求「只调数值，不改渲染器代码」。
- **深度**：**深**。四参数进、一个 `{buffer, layout}` 出，背后是「把参考图叠上去用 Difference 混合模式校准」级别的复杂度。
- **瑕疵**：第三参 `theme` 的**唯一调用方传的是 `undefined`**（share route:86）—— 这是一个**假设性 seam**（见 5.2）。返回的 `layout` 也无人使用。

**③ `src/lib/format.ts` —— 被低估的深模块**
- **接口**：一组纯函数：`formatExifLine` / `formatCamera` / `formatAperture` / `formatExposureTime` / `formatLocation` / `formatGps`。
- **实现**：EXIF 抽象值到人话的全部脏活：f-stop 序列吸附（`F_STOPS` 31 档）、`ƒ` 花体字、品牌名归一化（`NIKON CORPORATION` → `Nikon`）、机型前缀剥离、Nikon 下划线罗马数字（`Z 6_2` → `Z 6 II`）、手机机型去冗余前缀。
- **深度**：**深**（对纯函数而言，行为/接口比高）。**leverage**：详情页、灯箱、Feed 卡片、后台列表、分享图**五处**复用同一套格式化，这正是 depth 换来的杠杆。提交 `0ce974ee` 之后的注释（`format.ts:95-100`）说明作者是刻意把它从 `share.ts` 搬出来的 —— 这是本项目里一次正确的深化动作。

**④ `src/lib/geocode.ts` —— 全库唯一有真 adapter 的 seam**
- **接口**：`interface GeocodingProvider { name; reverse(lat, lng): Promise<LocationData | null> }`（`:13-16`）+ 编排器 `reverseGeocode(lat, lng)`（`:138-148`）。
- **adapter**：`bigDataCloud` 与 `nominatim` **两个**具体实现（`:124-127` 注册表）。按 vocabulary：**两个 adapter = 真 seam**。
- **深度**：**深**。5 秒超时、顺序回退、任何失败返回 null 且**永不阻塞上传**——这些不变式藏在接口后面。

**⑤ `src/lib/ai.ts` —— 深，但长了点**
- **接口**：`suggestMetadata(base64Image, mimeType): Promise<AiSuggestion>`（两个可空字符串字段）。
- **实现**：80 行 prompt 工程 + 20 秒 AbortController + 「CoT 模型 message 不在 output[0]」的解析怪招 + JSON 提取 + 正则兜底。
- **深度**：**深**。失败一律返回 `{null, null}` 而不抛 —— 调用方（suggest route:38-44）因此可以极薄。

### 4.2 浅模块 / 概念错位处

**⑥ Prisma 数据层 —— 不存在的模块（最严重的一处）**
- **接口**：没有。**接口就是整个 Prisma Client**。
- **现状**：`prisma.photo.*` 共 **20 处调用，散落在 9 个文件**：`app/(front)/page.tsx`、`app/(front)/photo/[slug]/page.tsx`、`app/(front)/map/page.tsx`、`app/sitemap.ts`、`app/admin/page.tsx`、`app/api/photos/route.ts`、`app/api/photos/rotate/route.ts`、`app/api/photos/[id]/download/route.ts`、`app/api/photos/[id]/share/route.ts`。
- **深度**：**浅到负**。每个调用点各自手写 `where` / `orderBy` / `take` / `select`，而**「城市 XOR 分类，一次只允许一个过滤」这条业务规则被写了两遍**：
  - `src/app/(front)/page.tsx:56-65`
  - `src/app/api/photos/route.ts:34-37`
  
  两处必须永远保持一致，却没有任何东西强制它们一致。侧边栏的聚合（`groupBy country/city` + `groupBy category`，`page.tsx:21-34`）又是第三份独立实现。
- **删除测试**：这里没有东西可删 —— 这恰恰是问题。该有的模块没被建出来，complexity 因此**没有集中点**，而是摊在 9 个调用点上。

**⑦ `src/lib/r2.ts` —— 一个模块塞了四种职责，接口比实现还复杂**
- **接口**：`R2_BUCKET`、`R2_PUBLIC_URL`、`getPublicUrl`、`uploadToR2`、`deleteFromR2`、`getShareKeyV2`、`extractKeyFromUrl` —— 7 个导出。
- **实现**：看似 108 行，但其中真正的「存储 adapter」只有 `uploadToR2` / `deleteFromR2` 两个薄函数。
- **深度**：**浅**（接口面宽、真正藏起来的复杂度少）。四类职责被塞在同一个文件里：
  1. 真正的 S3 客户端管理（`:7-30`）—— 合理；
  2. **URL 拼接约定**（`getPublicUrl`，`:39-41`）—— 合理；
  3. **分享图 key 命名 + 手写版本号**（`getShareKeyV2`，`:85-87`，硬编码 `-v12`）—— 这是**缓存策略**，不是存储；
  4. **`extractKeyFromUrl`**（`:96-108`）—— 从公有 URL **反向解析**出对象 key 的启发式函数，还要兼容新旧两种域名。
- **第 4 点的存在本身就是症状**：它之所以存在，是因为 DB 里存的是 **URL 而不是 key**（见 5.3）。

**⑧ `src/components/gallery/photo-grid.tsx` —— 接口小，但内部是三台状态机拼在一起**
- **接口**：`{ initialPhotos, totalCount, city, category }` —— 很小。
- **实现**：215 行里同时跑着 (a) 游标分页 + IntersectionObserver 无限滚动，(b) 灯箱开关 + `history.replaceState` + `popstate` 的 URL/历史同步，(c) 分享弹窗状态。三者通过 `photosRef`、`galleryUrlRef` 这类 ref 互相躲闪（`:47-56` 的注释直言「避免 YARL toolbar 因分页重新挂载」）。
- **深度**：**既深又乱**。它对外确实是深模块（4 个 prop 换 3 套交互），但**内部没有 seam**：想单独测试分页逻辑，必须跨过整个组件和它的历史操作。这三件事不是同一个概念，却被焊在一个文件里。

**⑨ `src/lib/auth.ts` —— 小，但定位正确**
- 接口就两个函数（`isAdmin` / `setAdminCookie`）+ 常量。**浅但合格**：一个 34 行的模块本就该是这个形状。真正的问题是**它的使用不一致**（见 5.4）。注意 `docs/architecture.md` 声称这是 JWT —— 并不是，它就是 `cookieStore.get("admin-token")?.value === process.env.ADMIN_TOKEN`（`auth.ts:12-14`）。

**⑩ `src/lib/slug.ts` —— 纯函数，形状没问题**
- 接口 `generateSlug(title): string`，实现含降级与随机后缀。**深**（足够）。问题不在模块，在**它被调用的时机**（见第 7 节）。

---

## 5. Seam 与职责边界

### 5.1 seam 总览

| seam | 位置 | 现状 | 判定 |
|---|---|---|---|
| 地理编码 | `lib/geocode.ts:13-16` | BigDataCloud + Nominatim **两个 adapter** | **真 seam**（唯一一个） |
| 对象存储 | `lib/r2.ts` | 只有 R2 一个 adapter（S3 协议） | **假设性 seam**。`CLAUDE.md` 显式拒绝多存储商，**不要**为此造抽象 |
| 分享图主题 | `lib/share.ts:550` 的 `theme` 形参 | 唯一调用方传 `undefined` | **假设性 seam**，删掉形参或真正用起来 |
| AI 供应商 | `lib/ai.ts` | 只有豆包，且直接 `fetch` 写死了 Responses API 格式 | **假设性 seam**。注释已解释为何不用 OpenAI SDK —— 保持现状 |
| 数据访问 | 不存在 | 9 个文件直连 Prisma | **缺失的 seam**（第 6 节首要项） |
| 图片处理 | `lib/image/pipeline.ts` | 内部 3 个 processor 是**内部 seam**（私有、无外部 adapter） | 形状正确：内部可换、外部只见 `pipeline()` |

### 5.2 「一对一」的诱惑

`share.ts` 的 `theme` 参数、`r2.ts` 的 S3 客户端、`ai.ts` 的 provider —— 这三个都是**只有一个 adapter 的 seam**。按定义它们是**假设性 seam**，逢一不可造抽象。项目目前做对了（没有为它们写工厂/注册表），值得保持。

### 5.3 三处互相泄漏的边界（本次审查的核心发现）

**泄漏 A：Prisma 数据层 ↔ 组件**
`city-sidebar.tsx:59-66` 自己拼 `/?city=<name>` 查询串，`photo-grid.tsx:96-99` 自己拼 `/api/photos?limit=…&cursor=…&city=…`，而**同一套过滤语义**在 `page.tsx:62-65`（构建 Prisma `where`）和 `api/photos/route.ts:34-37`（再构建一遍同样的 `where`）各写一次。过滤这个概念**没有家**，它在 UI、URL、route、Prisma 四处各自为政。

**泄漏 B：R2 adapter ↔ 数据库**
`photo.url` 存的是**完整公网 URL**（`https://cdn.bldcam.page/photos/2026/06/<uuid>.webp`）。于是：
- 删除照片时，必须先 `extractKeyFromUrl(photo.url)` **反推** key（`api/photos/route.ts:218, 222`）；
- 旋转照片时，同样反推（`api/photos/rotate/route.ts:75, 78`）；
- `extractKeyFromUrl`（`r2.ts:96-108`）因此被迫同时理解 CDN 域名变更史（`pub-xxx.r2.dev` 与 `cdn.bldcam.page`），提交 `2025407b` 就是为补这个兼容。

**key 的布局约定也被复制粘贴**：`photos/${year}/${month}/${uuid}.webp` 在 `pipeline.ts:49-50` 和 `rotate/route.ts:88-89` 各写一遍。存储布局是存储模块的事，却有两个地方知道它。

**泄漏 C：CDN 缓存契约 ↔ 三处代码 + 一次手工版本号仪式**

这是全库最典型的「契约漏出去」：

1. **旋转靠换 key 来绕过缓存**：`rotate/route.ts:82` 的注释直说「Upload to new keys (bust CDN cache)」，于是每次旋转都产生一套新对象、删一套旧对象（`:112-116`，且是 best-effort）。
2. **分享图靠手写版本号来绕过缓存**：`getShareKeyV2` 里硬编码 `-v12`（`r2.ts:86`）。翻 git log 能看到完整的仪式史：`cache key v3` → `v4` → `v5` → … → `v11` → `cache v12`，每次都为了「让用户看到新图」而手动 +1。**这是一条把缓存失效策略编进字符串常量的路径**，且它躺在存储模块里。
3. **分享 route 用 HEAD 探测自家缓存**：`share/route.ts:46` 先 `fetch(shareUrl, { method: "HEAD" })` 判断是否已缓存。

**第 3 点必须说清楚**：项目自己踩过这个坑并写进了 README 第 6 条 ——「R2 的 HEAD 请求恒返回 `cf-cache-status: DYNAMIC`，测 R2/CDN 缓存必须用 GET」。代码里的 HEAD 只能证明**对象存在**，**证明不了缓存命中、更证明不了缓存是否为最新**。所以：
- 「命中缓存」= 「R2 里有个同名对象」，与内容新旧无关；
- 而 `PATCH` 改标题（`api/photos/route.ts:169`）和旋转都**不会**去动 `share/{id}/…-v12.png`；
- 结论：**改完标题再点分享，拿到的仍是旧标题的图**，直到有人手动把 `v12` 改掉。这是一个可复现的正确性问题，根因就是缓存契约没有归到一个模块里。

### 5.4 顺带：auth 的调用面不一致

`api/photos/route.ts:9-13` 定义了本地 `guard()`（返回 `NextResponse | undefined`，靠「undefined 即通过」这种隐式契约工作），而 `rotate/route.ts:20` 和 `suggest/route.ts:16` 各自内联 `await isAdmin()`。三处写法、两种模式、一个概念。风险不在当下，在新增 endpoint 时容易漏 guard —— 提交历史里 `GET /api/photos` 就是**故意**不加 guard 的公共端点（注释 `route.ts:25-26`），这种「何时该加」的判断没有单一出处。

---

## 6. 摩擦与深化机会（按优先级排序）

### 机会 1 —— 建一个数据访问模块，把「照片查询」收成一个接口 ★最强推荐

- **模块**：新建 `src/lib/photos.ts`（或 `src/lib/photo-queries.ts`）。
- **为什么现在是浅的**：20 处调用、9 个文件、过滤规则写两遍、聚合逻辑写三遍、分页参数各拼各的。按删除测试 —— 现在**没有可删的东西**，复杂度散在调用点里，改一次规则要动四个地方。
- **更深的接口应该长这样**（形状示意，非最终签名）：
  - `listPhotos({ city?, category?, cursor?, limit? })` → 内部封装「城市 XOR 分类」规则 + 游标分页 + `nextCursor` 计算；
  - `getPhotoBySlug(slug)` / `getPhotoById(id)`；
  - `getFilterOptions()` → 返回 `{ countryGroups, categories, totalCount }`，把两个 `groupBy` 与分组 Map 逻辑（`page.tsx:21-51`）藏进去；
  - `listMapPhotos(limit)` → 把 `map/page.tsx:7-32` 那份 15 字段 `select` 藏进去；
  - 写操作同样收口：`createPhoto` / `updatePhotoMeta` / `deletePhoto`（含 R2 key 清理）。
- **leverage**：首页 RSC、分页 route、sitemap、地图页、后台页**五处**共用一个接口。
- **locality**：过滤规则、排序、`take` 上限、字段投影只有一处需要知道。**测试面**：接口即测试面，可注入一个 SQLite 测试库或在内存里替换 adapter，第一次让数据逻辑变得可测。
- **代价**：一次纯机械的重构，无 schema 变更，无行为变更 —— 风险最低、收益最广。**建议先做这个。**

### 机会 2 —— DB 存对象 key，而不是存公网 URL

- **模块**：`prisma/schema.prisma` + `src/lib/r2.ts` + 三个调用点。
- **为什么现在是浅的**：`extractKeyFromUrl`（`r2.ts:96-108`）是**为了弥补一个数据建模错误而存在的启发式函数**。存储 adapter 被迫理解 CDN 域名的历史变迁。删除测试：删掉 `extractKeyFromUrl`，复杂度立刻在 delete / rotate 两处重现 —— 它确实在挣饭吃，但它挣的是**本不该存在的饭**。
- **更深的接口**：`Photo` 增加 `storageKey` / `thumbKey`（或统一为一个 `key` 前缀），**URL 变成派生值**：写入时 `getPublicUrl(key)`，读取时同理。于是删除/旋转只需 `deleteFromR2([photo.storageKey])`，不再反解析任何东西；域名再换一次也不用改代码。
- **顺带合并**：把 `photos/${year}/${month}/…` 这段布局从 `pipeline.ts:49-50` 和 `rotate/route.ts:88-89` 移进 `r2.ts`，成为 `buildPhotoKey()`。存储布局只应有一个出处。
- **leverage**：delete、rotate、未来的任何「重新处理」功能。
- **代价**：需要一次性数据迁移 + 回填（老 URL 走一次 `extractKeyFromUrl` 把 key 写进新列，之后这个函数就能退役）。本地 SQLite 单文件，迁移成本很低。**这是收益/代价比第二高的一项。**

### 机会 3 —— 把分享图的「缓存 + 生成 + 投递」合成一个模块

- **模块**：`src/lib/share-card.ts`（新），route 变薄。
- **为什么现在是浅的**：`share/route.ts` 一个函数里塞了 5 件事：template 校验、DB 查询、缓存探测（HEAD）、生成（sharp 重活）、回写 R2、再加一层基于 `Accept` 头的内容协商。接口面宽（4 种可能响应：307 / PNG / 400 / 500），实现只是把它们串起来。
- **更深的接口**：
  - `getShareCard(photo, template)` → `{ buffer, contentType } | { redirectUrl }`，把 HEAD 探测、生成、回写、key 版本全部藏进去；
  - route 只剩下「解析参数 → 调它 → 按 Accept 投递」。
  - **并把失效接上**：key 里带上 `photo.updatedAt` 的哈希（或让 `updatePhotoMeta` / `rotate` 顺手删掉两个 template 的缓存 key）。这一条直接消灭第 5.3 节的 stale-share bug 和第 7 节的一项债务。
- **leverage**：`-v12` 这类手工仪式终结；以后调视觉只需改 `CLASSIC_THEME` 数值 + 失效策略一处生效。
- **顺带修文档**：`share/route.ts:16-19` 的注释**与实现完全相反** —— 注释说 `image/* → 200 PNG`、`text/html → 307`、其余 `→ JSON {url}`；实际代码是 `image/* → 307`、其余 `→ PNG 代理`，且**根本不存在返回 JSON 的分支**。这种「接口描述说谎」对 AI-navigability 伤害很大，顺手改掉。

### 机会 4 —— slug 一经分配不再改变

- **模块**：`src/app/api/photos/route.ts:150-195`（PATCH）+ `src/lib/slug.ts`。
- **为什么现在是浅的/错的**：`PATCH` 改标题时**重新生成 slug**（`:169`），slug 又是 `@unique` 且被 sitemap（`sitemap.ts:32-37`）和 JSON-LD（`photo/[slug]/page.tsx:94`）引用。后果：旧链接 404、搜索引擎的已收录 URL 变成软 404、外部已分享的 `/photo/<旧 slug>` 失效。
- **更深的接口**：标题可改，**slug 不变**（创建时定终身）；若确实需要可读 URL，则加一张 `Redirect` 记录或保留旧 slug 别名。接口从「改标题 → 顺带改身份」变成「改标题只改标题」。
- **leverage / locality**：URL 的稳定性成为一个不变式，只在一个地方维护。

### 机会 5 —— 拆开 `photo-grid` 的三台状态机（可选，优先级最低）

- **模块**：`photo-grid.tsx` → `usePhotoPagination()`（分页 + 游标）、`useLightboxHistory()`（灯箱 ⇄ `history.replaceState`/`popstate` 同步）、`ShareDialog` 的挂载点。
- **为什么值得做**：现在 `photosRef` / `galleryUrlRef` 两个 ref 的存在，是为了让三台状态机互不干扰；分页逻辑目前**无法在没有 DOM 和浏览器历史的情况下测试**。
- **注意**：这是纯粹的内部 seam（不改变 `photo-grid` 对外的 4 个 prop），属于「如果还要改这块再做」。项目已 6 周未动，**不建议现在动**。

> **关于 YAGNI**：`CLAUDE.md` 的优先级是「简单 > 性能 > 学习价值」。上面前 4 项都是**消除已有重复**，不是加抽象层，符合项目哲学。第 5 项才是真·重构，可以做但也最容易过度设计。另外 **不要**为 R2 / AI / 分享图主题造 provider 抽象 —— 它们各自只有一个 adapter。

---

## 7. 风险与债务

### 7.1 安全（最高优先级）

1. **管理员凭据是默认占位符 / 弱口令**。`.env` 第 16 行 `ADMIN_TOKEN` 仍是模板默认串（形如 `change-me-…`），而 `auth.ts:14` 的鉴权逻辑是 **cookie 值 === ADMIN_TOKEN**、`setAdminCookie` 写入的也正是这个值。也就是说，**任何知道该默认串的人，手工设置 cookie `admin-token=<该串>` 即获得全部管理权限**（上传 / 删除 / 旋转 / 改标题）。`.env` 第 15 行的 `ADMIN_PASSWORD` 是生日型弱口令，同样可猜。
   - `.env` **未被 git 跟踪**（`.gitignore:33`，`git ls-files` 确认干净）—— 这点做得对。
   - 但 `deploy.sh:21` 会把 `.env` 复制成 `deploy-dist/.env.production` 并 rsync 上服务器，因此**默认 token 极可能正是线上生效的那一个**；同时本机残留 `deploy-dist/.env.production` 一份明文副本。
   - **行动**：轮换 `ADMIN_TOKEN` 为长随机串，轮换 `ADMIN_PASSWORD`，并考虑把 token 从 cookie 明文值改为不可逆的派生值（例如 cookie 存哈希）。**本文档不记录任何凭据值**，因为本文件会进入公开 repo。

2. **无鉴权的重端点**。`/api/photos/[id]/share` 与 `/api/photos/[id]/download` 都是公开 GET，且都做 sharp 重活。`download` 尤其危险：**每次都从 R2 拉原图 + 在内存里 WebP→PNG 重编码**（`download/route.ts:23-32`），没有任何服务端缓存 —— 对一台小 VPS 是现成的 CPU/内存耗尽入口。分享图至少有确定性 key 兜底（每张图最多渲染 2 次）。

3. **精确 GPS 完全公开**。`GET /api/photos` 直接把整行 `Photo` 返回（`api/photos/route.ts:52`），包含 `latitude`/`longitude`/`fullAddress`；`/map` 再把每一张的坐标画出来。作品集通常可以接受，但请确认这是有意的 —— 若照片摄于住处附近，等于公开住址。

### 7.2 正确性 / 数据完整性

4. **分享图缓存永不失效**（详见 5.3 泄漏 C）：改标题、旋转之后，`share/{id}/{template}-v12.png` 仍是旧的。**已可复现**。
5. **PATCH 改标题会换 slug**（`api/photos/route.ts:169`）：旧 URL 变 404、sitemap 抖动、JSON-LD 的 `url` 随之改变。见机会 4。
6. **R2 与 DB 的一致性靠 best-effort**。删除时 R2 失败仅 `console.error` 后继续删 DB（`api/photos/route.ts:234-243`），旋转时旧对象清理失败只 warn（`rotate/route.ts:112-116`）。设计上「DB 是唯一真相源」是明说的、可接受的取舍，但结果是**孤儿对象会累积且无任何巡检**。至少可以加一个手动的对账脚本。
7. **删除时硬编码了分享图的 template 名单**：`api/photos/route.ts:227-228` 手动 push `"classic"` 和 `"signature"` 两个 key。哪天加第三个模板，删除就会漏掉缓存对象 —— 又一个「存储层的契约泄漏到调用点」。
8. **`dmsToDecimal` 畸形输入静默返回 `0`**（`lib/image/exif.ts:99`）而非 `null`，GPS 残缺的照片可能被写成 (0, 0) 并出现在地图上的几内亚湾。应返回 `null`。
9. **`totalCount` 与列表口径不一致**（`page.tsx:18` 计全库，`filteredCount:74` 计过滤后）—— 目前用于「共 N 张照片」的文案，逻辑上说得通，但两个语义相近的计数并列传递容易在后续改动中被误用。

### 7.3 部署 / 运维

10. **跨平台构建 + 远端打补丁的部署链非常脆**。macOS 上 `next build`（`deploy.sh:11`）→ rsync 到 Linux VPS → 由 `vps-setup.sh` 就地修补：`sed` 改写 `DATABASE_URL`（`:13`）、`npm install --force --platform=linux` 重装 sharp（`:18`）、`rm` 掉 `.next/node_modules/@prisma` 的符号链接再整目录拷贝（`:30-34`）。历史提交（`45d32091`、`0626c71f`、`adb97785`）显示这条链已经反复出问题。任何一步静默失败（脚本刻意不用 `set -e`，`:4-5`）都会留下半新半旧的产物。
11. **`rsync --delete` + 排除 `dev.db`**（`deploy.sh:24-31`，排除项在 `:26`）：README 开发笔记第 4 条明确记载**这个坑已经踩过并清掉了数据库**。当前排除写法正确（`/node_modules/` 带锚点，见 `b817e16c`），但这是靠注释和提交记忆维持的安全，不是靠机制。
12. **无数据库备份**。`dev.db` 被排除在 rsync 之外，因此线上那一份是孤本，`deploy.sh` 里没有任何备份步骤。SQLite 单文件备份成本极低（`sqlite3 .backup` 或定时 cp），值得补。
13. **全站 `force-dynamic`、零 ISR**。首页每次请求跑 4 条查询（1 count + 2 groupBy + 2 findMany/count），map 每次最多取 200 行，sitemap 每次爬取都全表扫 slug。对一个作品集，`export const revalidate = 60` 之类的缓存几乎无成本，收益立竿见影。注意：这与「极简」不冲突 —— 它是在删代码而不是加代码。
14. **地图无聚合**。`photo-map.tsx:145-170` 为每张照片渲染一个 `<Marker>`，一次最多 200 个；而 `supercluster` **已声明为依赖却从未被 import**，`CLAUDE.md` 里「Use clustering for photo markers」的要求并未实现。照片变多时这是第一个会卡的地方。

### 7.4 可维护性

15. **零测试**。`package.json` 无 `test` 脚本，全库无 `*.test.*` / `*.spec.*`。最可惜的是 `format.ts`、`slug.ts`、`geocode.ts`、`pipeline.ts` 这四个**天生可测**的模块也没有 —— 它们恰好都是纯函数或依赖可注入。补测试的成本极低（尤其 `formatCamera` 那堆品牌/机型边界）。
16. **`docs/architecture.md` 与实现脱节**（见第 2 节末尾的警告框）。一个会误导 agent 的架构文档，比没有文档更贵。
17. **未使用的依赖**：`supercluster`（本应用该用却没用）、`@base-ui/react`、`zod`、`openai`（`ai.ts` 是裸 `fetch`，注释解释了原因）。清理它们能缩短安装时间、缩小攻击面。
18. **手写缓存版本号仪式**（`v3…v12` 的提交史）。它是「缺少失效机制」的可见症状，不是独立的怪癖 —— 修机会 3 就自然消失。

---

## 8. 一页速览

**动手前先读这张表。** 深度列：深 = 接口小、行为厚（可放心依赖）；浅 = 接口面宽或概念没归位（改之前先想清楚）。

| 文件 / 位置 | 职责 | 深度 | 改动前必须知道 |
|---|---|---|---|
| `src/lib/image/pipeline.ts` | 上传流水线编排（sharp + EXIF + LQIP + geocode + R2 + 回滚） | **深** | 单一入口 `pipeline(buffer)`；`uploadedKeys` 是回滚契约，别丢 |
| `src/lib/share.ts` | 分享图渲染（587 行，布局/阴影/文字/签名/composite） | **深** | 视觉数值全在 `CLASSIC_THEME`（`:19-118`），**只调数值不改渲染器**；第 3 参 `theme` 无人使用 |
| `src/lib/format.ts` | EXIF / 相机 / 地点格式化（纯函数） | **深** | 5 处共用；改这里会同时影响详情页、灯箱、Feed、后台、分享图 |
| `src/lib/geocode.ts` | 反地理编码，2 个 provider 顺序回退 | **深** | **全库唯一的真 seam**；5s 超时，失败返回 `null` 且不阻塞上传 |
| `src/lib/ai.ts` | 豆包视觉模型起名/分类 | **深** | 走 Responses API（非 Chat Completions）；CoT 内容在 `output.find(type==="message")`，别取 `output[0]` |
| `src/lib/r2.ts` | R2 客户端 + URL 拼接 + **分享图 key（硬编码 `-v12`）** + **URL→key 反解析** | **浅/混杂** | 4 类职责挤在一起；`extractKeyFromUrl` 是数据建模缺陷的补丁 |
| `src/lib/auth.ts` | 明文 cookie 比对 | 浅但合格 | `cookie === ADMIN_TOKEN`；`ADMIN_TOKEN` 可能仍是默认占位串 ⚠ |
| `src/lib/slug.ts` | 标题 → URL slug（降级 + 随机后缀） | 深 | ⚠ 被 PATCH 调用 → 改标题会换 URL |
| `src/lib/image/exif.ts` | exifr 封装 + DMS→十进制 | 深 | `dmsToDecimal` 畸形输入返回 `0`（应为 `null`） |
| `src/lib/image/thumbnail.ts` | sharp 2000px webp q90 + 800px thumb | 深 | `fit: "inside"` 是刻意的（不能用 cover） |
| `src/lib/image/blurhash.ts` | 16px base64 PNG LQIP（**不是** blurhash 库） | 深 | 文件名有误导性 |
| `src/app/(front)/page.tsx` | 首页 RSC：全量 count + 2×groupBy + 首屏 20 张 | **浅（数据逻辑未收口）** | `force-dynamic`；过滤规则与 `api/photos/route.ts:34-37` **重复** |
| `src/app/(front)/photo/[slug]/page.tsx` | 照片详情 + SEO(JSON-LD) | 中 | ⚠ `findUnique` 在 `:18` 与 `:48` **跑两次** |
| `src/app/(front)/map/page.tsx` | 地图页 RSC，取 200 行 | 中 | 与 `photo-map.tsx` 的 `MapPhoto` 字段列表必须手动同步 |
| `src/features/map/photo-map.tsx` | MapLibre 地球 + 悬浮卡片 | 中 | 逐点渲染 **无聚合**（`supercluster` 声明了却未用） |
| `src/components/gallery/photo-grid.tsx` | 分页 + 灯箱/历史 + 分享弹窗（三合一） | **深但无内部 seam** | `photosRef` / `galleryUrlRef` 是给三台状态机让路的，别乱删 |
| `src/components/gallery/photo-card.tsx` | 瀑布流卡片 | 浅 | `memo` 比较器只比 `id` 和 `priority` |
| `src/components/gallery/photo-lightbox.tsx` | YARL 灯箱 + EXIF 浮层 + 工具按钮 | 中 | 按钮必须走 YARL 的 toolbar 插槽（避免 z-index 冲突） |
| `src/components/gallery/share-dialog.tsx` | 分享图预览 / 切模板 / 下载 | 中 | 用 `seqRef` 丢弃过期响应；`blob.type` 必须是 `image/*` |
| `src/components/admin/upload-zone.tsx` | 多文件队列 + AI 建议 + XHR 进度 | 中 | 逐张串行；AI 是 fire-and-forget，失败静默 |
| `src/app/api/photos/route.ts` | 上传 / 列表 / 改 / 删（一个文件 4 个 HTTP 方法） | **浅** | `guard()` 靠「返回 undefined = 通过」的隐式契约；GET 故意公开 |
| `src/app/api/photos/[id]/share/route.ts` | 分享图缓存 + 生成 + 投递 | **浅（5 件事）** | ⚠ 顶部注释与实现**相反**；HEAD 只能证明对象存在，不能证明缓存新鲜 |
| `src/app/api/photos/[id]/download/route.ts` | 拉原图 → WebP→PNG → 附件下载 | 浅 | 每次请求都重编码，**无缓存**；非原始格式（已是 2000px webp） |
| `src/app/api/photos/rotate/route.ts` | 旋转 90°，换新 key 绕缓存 | 中 | 删除逻辑 best-effort；key 布局与 `pipeline.ts:49-50` 重复 |
| `src/app/api/photos/suggest/route.ts` | AI 起名/分类端点 | 深（薄封装） | 512px webp q60 → base64；任何失败返回 null 字段 |
| `prisma/schema.prisma` | 单表 `Photo`（30+ 字段） | — | 无 `migrations/` 目录；`slug` 为 `@unique` 可空 |
| `deploy.sh` / `vps-setup.sh` | 本地构建 → rsync → 远端打补丁 → PM2 | — | ⚠ `rsync --delete`（`dev.db` 曾因此被删）；sharp/prisma 靠远端脚本修补；`deploy.sh:21` 复制 `.env` 上路 |
| `docs/architecture.md` | 声称的架构说明 | — | ⚠ **已过期**：JWT / `src/types/` / blurhash 均不存在 |

**三条最该记住的不变式**
1. 图片**永远**从 `cdn.bldcam.page` 直出，应用服务器只发 URL（`next.config.ts:6` 的 `unoptimized`）。改这条会动摇整个性能模型。
2. `share/{photoId}/{template}-v12.png` 是**确定性且手工版本化**的缓存 key —— 改了渲染就必然要处理失效，否则用户看到的还是旧图。
3. DB 是唯一真相源，R2 删除是 best-effort —— 所以**永远不要**反过来假设 R2 里的对象一定对应一条记录，或反之。

---

*本文件由架构审查生成，仅新增此一个文件，未改动任何既有代码。所有路径与行号均经核实；不确定处已标注「未确认」。*
