# 星空摄影作品集 — BLDcam

> 个人星空摄影作品展示网站，记录每一次追星之旅

[![Version](https://img.shields.io/badge/version-2.0.1-purple?style=flat-square)](https://bldcam.page)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square)](https://nextjs.org/)
[![Deployed](https://img.shields.io/badge/Deployed-bldcam.page-blue?style=flat-square)](https://bldcam.page)

## 项目介绍

个人星空摄影作品集，围绕作品展示、地点标记、EXIF 数据可视化构建。不做 SaaS，只做一件事：把星空照片呈现好。

### 核心功能

- **摄影画廊** — 瀑布流布局展示作品，支持分类和标签筛选
- **双主题** — 默认暗色（星空专用暖色高光替代蓝色调），一键切亮色
- **地图标记** — MapLibre 集成，每张照片标注拍摄地点，交互式浏览
- **EXIF 数据** — 自动提取相机参数（ISO、快门、光圈、焦距、时间）
- **双视图模式** — "沉浸" / "列表" 自由切换
- **AI 标题/分类建议** — 上传时由豆包视觉模型（Volcengine Ark）给出标题与分类建议，手动触发、可改可不改
- **管理后台** — 登录后可上传、编辑、管理照片（admin 路由）

### 适用场景

- 个人星空摄影作品展示
- 摄影爱好者的自建作品集
- 学习 Next.js + Prisma + R2 的全栈项目参考

## 功能清单

| 功能名称 | 功能说明 | 技术栈 | 更新时间 | 版本 |
|---------|---------|--------|----------|------|
| 摄影画廊 | 瀑布流布局展示 | React + Tailwind | 2026-07-04 | v1.0 |
| 地图标记 | 照片拍摄地点标记（逐点渲染，无聚合） | MapLibre GL | 2026-07-04 | v1.0 |
| EXIF 提取 | 自动读取相机参数 | exifr | 2026-07-04 | v1.0 |
| 双主题 | 亮/暗切换，默认暗色 | React Context + localStorage | 2026-07-04 | v1.0 |
| 双视图模式 | 沉浸/列表切换 | React Context | 2026-07-04 | v1.0 |
| AI 标题/分类建议 | 上传时给出标题与分类建议（不含描述） | 豆包 Seed 2.0 / Volcengine Ark | 2026-06-20 | v1.0 |
| 管理后台 | 照片上传/编辑/管理 | Next.js admin route | 2026-06-21 | v1.0 |
| 图片存储 | Cloudflare R2 对象存储 | @aws-sdk/client-s3 | 2026-06-14 | v1.0 |
| 分享图 | 经典 EXIF + 签名 SVG 双模板 | Sharp 服务端合成 | 2026-07-24 | v1.8 |
| 分享图 UI | 弹窗预览 + 模板切换 | shadcn Dialog + YARL portal | 2026-07-26 | v2.0 |
| 原图下载 | WebP→PNG 转码下载 | Sharp 服务端转码 | 2026-08-06 | v2.0.1 |
| 分享图稳定性 | 已缓存直接返回 PNG + CDN 边缘缓存 | R2 Custom Domain + 服务端代理 | 2026-08-06 | v2.0.1 |

## 技术栈

| 技术 | 版本 | 用途 | 官网 |
|------|------|------|------|
| Next.js | 16.2.9 | React 框架 | https://nextjs.org |
| React | 19.2.4 | 前端 UI | https://react.dev |
| TypeScript | 5 | 类型安全 | https://www.typescriptlang.org |
| Tailwind CSS | 4 | 样式 | https://tailwindcss.com |
| Prisma | 6.19.3 | ORM + SQLite | https://prisma.io |
| SQLite | — | 数据库 | — |
| MapLibre GL | 5.24.0 | 地图渲染 | https://maplibre.org |
| 豆包 Seed 2.0 | — | AI 标题/分类 | https://volcengine.com |
| Cloudflare R2 | — | 图片存储 | https://cloudflare.com |
| Sharp | 0.35 | 图片处理 | https://sharp.pixelplumbing.com |

### 技术架构

```
用户浏览器
    │
    ├── Next.js (App Router)
    │   ├── (front)/     → 公开页面（画廊、地图、照片详情）
    │   ├── admin/       → 管理后台（需密码）
    │   └── api/         → REST API（照片 CRUD、AI 建议）
    │
    ├── Prisma → SQLite          ← 结构化数据
    ├── Cloudflare R2            ← 原始图片存储
    └── 豆包/Volcengine Ark      ← AI 标题 + 分类
```

## 项目结构

```
camlife-lite/
├── src/
│   ├── app/
│   │   ├── (front)/              # 前端页面
│   │   │   ├── page.tsx          # 首页画廊（SSR 首屏 20 张）
│   │   │   ├── photo/            # 照片详情
│   │   │   └── map/              # 3D 地球照片地图
│   │   ├── admin/                # 管理后台（上传 + 管理）
│   │   ├── api/                  # 7 个 API 端点
│   │   │   ├── auth/             # 登录/退出
│   │   │   └── photos/           # CRUD + AI suggest
│   │   ├── layout.tsx
│   │   └── globals.css           # 亮/暗双主题变量
│   ├── components/
│   │   ├── admin/                # 上传队列 + 照片管理
│   │   ├── gallery/              # 瀑布流卡片 + Feed 流 + 灯箱
│   │   ├── layout/               # Header 胶囊栏 + 侧边栏
│   │   └── ui/                   # shadcn 基础组件
│   ├── context/                  # 视图模式（waterfall/feed）
│   ├── features/map/             # MapLibre 地图（逐点 Marker，无聚合）
│   ├── hooks/                    # 自定义 Hooks
│   ├── lib/                      # AI、R2、auth、geocode、prisma、图片流水线
├── prisma/
│   └── schema.prisma             # Photo 模型
├── scripts/                      # 工具脚本
├── docs/                         # 项目文档
├── deploy-dist/                  # 部署产物
├── ARCHITECTURE.md               # 架构审查（深/浅模块、seam、风险）
├── CLAUDE.md                     # AI 助手配置
├── deploy.sh                     # 一键部署脚本
├── vps-setup.sh                  # VPS 初始化
└── package.json
```

## 安装说明

### 环境要求

- Node.js >= 20.9（Next.js 16 要求）
- npm
- Cloudflare R2 账号（图片存储）
- 豆包/Volcengine Ark API Key（可选，用于 AI 标题/分类建议）

### 安装步骤

```bash
# 1. 克隆 + 安装
git clone https://github.com/OUENMING/bldcam.git
cd camlife-lite && npm install

# 2. 配置 .env（该文件不进版本库）
touch .env
# 必填：R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_ENDPOINT /
#       R2_REGION / R2_PUBLIC_URL、ADMIN_PASSWORD、ADMIN_TOKEN
# 可选：ARK_API_KEY、ARK_BASE_URL（豆包 AI 标题/分类建议）

# 3. 初始化数据库
npx prisma db push

# 4. 启动开发服务器
npm run dev
```

打开 http://localhost:3000 访问；后台在 http://localhost:3000/admin。

## 使用说明

### 开发命令

```bash
npm run dev         # 启动开发服务器
npm run build       # 构建生产版本
npm run start       # 启动生产服务器
npm run lint        # 代码检查
npx prisma studio   # 数据库管理界面
```

### 部署

```bash
npm run build
bash deploy.sh      # 一键推送到 VPS
```

项目部署在 https://bldcam.page，VPS + PM2 + Nginx 运行。

图片经 Cloudflare R2 Custom Domain 提供：`cdn.bldcam.page` 挂在 R2 桶 `photosave` 的 **Settings → Custom Domains**，对象带 `max-age=31536000, immutable`，启用边缘缓存。

分享图/图片变慢或"有时加载失败"时，依次查两处：

1. 该 Custom Domain 连接是否还在
2. GET 响应头 `cf-cache-status` 是否为 `HIT`

## 设计哲学

- **极简**：不做 SaaS，不做商业化，只做好"展示星空照片"这一件事
- **沉浸**：暗色主题 + 暖色高光替代蓝色调，减少视觉干扰
- **自主**：自建 VPS + Cloudflare R2，不依赖第三方平台

## 开发笔记

1. **豆包 CoT 模型的 output** 在 `output.find(o => o.type === "message")`，不能直接取 `output[0]`
2. **Sharp** 用 `fit: "inside"` 保留原比例，别用 `fit: "cover"`——否则瀑布流像砖墙一样死板
3. **腾讯云 22 端口被拦截** — 换 2222 端口连接
4. **rsync `--delete` 把数据库清了** — 必须加 `--exclude='dev.db'`
5. **分享图已缓存返回 JSON 的坑** — 前端 `fetch` 默认 `Accept: */*`，API 若对非 `image/*` 返回 JSON，前端 `blob.type` 判断会抛 "Not an image" 显示"生成失败"。修复：已缓存时服务端代理返回真 PNG（image 客户端仍走 307 直连）
6. **R2 的 HEAD 请求恒返回 `cf-cache-status: DYNAMIC`** — 测 R2/CDN 缓存必须用 GET，用 `curl -I` 会被误导；且 R2/CDN 无 CORS 头时，前端 fetch 不能跟随跨域 307，只能服务端代理或用 `<img>` 直载

## 项目总结

详见 [docs/项目总结.md](docs/项目总结.md) — 完整时间线、13 个难点、经验教训。

## 致谢

本项目 UI 灵感和部分交互方案参考了 [sun0225SUN/camlife](https://github.com/sun0225SUN/camlife)，一个出色的摄影作品集项目。架构自行从零搭建，感谢开源社区。

## License

MIT

Copyright (c) 2026 Owen
