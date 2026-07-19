# 星空摄影作品集 — BLDcam

> 个人星空摄影作品展示网站，记录每一次追星之旅

[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square)](https://nextjs.org/)
[![Deployed](https://img.shields.io/badge/Deployed-bldcam.page-blue?style=flat-square)](https://bldcam.page)

## 项目介绍

BLDcam 是一个个人星空摄影作品集网站。围绕摄影作品展示、地点标记和 EXIF 数据可视化构建，没有 SaaS 化意图，专注做好一件事：把星空照片呈现好。

### 核心功能

- **摄影画廊** — 瀑布流布局展示星空摄影作品，支持分类和标签筛选
- **夜间模式** — 默认暗色主题，星空专用的暖色高光替代蓝色调，视觉沉浸
- **地图标记** — MapLibre 集成，每张照片标注拍摄地点，交互式地图浏览
- **EXIF 数据** — 自动提取相机参数（ISO、快门、光圈、焦距、时间）
- **双视图模式** — "沉浸"和"列表"两种浏览方式自由切换
- **AI 描述** — 豆包视觉模型自动生成照片描述和拍摄故事
- **管理后台** — 登录后可上传、编辑、管理照片（admin 路由）

### 适用场景

- 个人星空摄影作品展示
- 摄影爱好者的自建作品集
- 学习 Next.js + Prisma + R2 的全栈项目参考

## 功能清单

| 功能名称 | 功能说明 | 技术栈 | 更新时间 | 版本 |
|---------|---------|--------|----------|------|
| 摄影画廊 | 瀑布流布局展示 | React + Tailwind | 2026-07-19 | v0.1.0 |
| 地图标记 | 照片拍摄地点标记 | MapLibre + react-map-gl | 2026-07-19 | v0.1.0 |
| EXIF 提取 | 自动读取相机参数 | exifr | 2026-07-19 | v0.1.0 |
| 夜间模式 | 星空专用暗色主题 | React Context | 2026-07-19 | v0.1.0 |
| 双视图模式 | 沉浸/列表切换 | React Context | 2026-07-19 | v0.1.0 |
| AI 描述 | 自动生成照片故事 | 豆包 Seed 2.0 | 2026-07-19 | v0.1.0 |
| 管理后台 | 照片上传/编辑/管理 | Next.js admin route | 2026-07-19 | v0.1.0 |
| 图片存储 | Cloudflare R2 对象存储 | @aws-sdk/client-s3 | 2026-07-19 | v0.1.0 |

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
    │   └── api/         → REST API（照片 CRUD、AI 描述）
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
│   │   └── globals.css           # 暗色主题变量
│   ├── components/
│   │   ├── admin/                # 上传队列 + 照片管理
│   │   ├── gallery/              # 瀑布流卡片 + Feed 流 + 灯箱
│   │   ├── layout/               # Header 胶囊栏 + 侧边栏
│   │   └── ui/                   # shadcn 基础组件
│   ├── context/                  # 视图模式（waterfall/feed）
│   ├── features/map/             # MapLibre + Supercluster
│   ├── hooks/                    # 自定义 Hooks
│   ├── lib/                      # AI、R2、auth、geocode、prisma、图片流水线
│   └── types/                    # TypeScript 类型定义
├── prisma/
│   └── schema.prisma             # Photo 模型
├── scripts/                      # 工具脚本
├── docs/                         # 项目文档
├── deploy-dist/                  # 部署产物
├── CLAUDE.md                     # AI 助手配置
├── deploy.sh                     # 一键部署脚本
├── vps-setup.sh                  # VPS 初始化
└── package.json
```

## 安装说明

### 环境要求

- Node.js >= 18
- npm
- Cloudflare R2 账号（图片存储）
- 豆包/Volcengine Ark API Key（可选，用于 AI 描述）

### 安装步骤

```bash
# 克隆
git clone https://github.com/OUENMING/bldcam.git
cd camlife-lite && npm install

# 复制环境变量模板，填上密钥
cp .env.example .env
# 必填：R2_* 系列、ADMIN_PASSWORD
# 可选：ARK_API_KEY（豆包 AI）

# 初始化数据库
npx prisma db push

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000 即可访问。
后台在 http://localhost:3000/admin。

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

项目部署在 https://bldcam.page，使用 VPS + PM2 + Nginx 运行。

## 设计哲学

- **极简**：不做 SaaS，不做商业化，只做好"展示星空照片"这一件事
- **沉浸**：暗色主题 + 暖色高光替代蓝色调，减少视觉干扰
- **自主**：自建 VPS + Cloudflare R2，不依赖第三方平台

## 开发笔记

1. **豆包 CoT 模型的 output** 在 `output.find(o => o.type === "message")`，不能直接取 `output[0]`
2. **Sharp** 用 `fit: "inside"` 保留原比例，别用 `fit: "cover"`——否则瀑布流像砖墙一样死板
3. **腾讯云 22 端口被拦截** — 换 2222 端口连接
4. **rsync `--delete` 把数据库清了** — 必须加 `--exclude='dev.db'`

## 项目总结

详见 [docs/项目总结.md](docs/项目总结.md) — 完整时间线、13 个难点、经验教训。

## 致谢

本项目 UI 灵感和部分交互方案参考了 [sun0225SUN/camlife](https://github.com/sun0225SUN/camlife)，一个出色的摄影作品集项目。架构自行从零搭建，感谢开源社区。

## License

MIT

Copyright (c) 2026 Owen
