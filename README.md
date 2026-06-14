# 📷 BLDcam — 菠萝丁的摄影自留地

> 一个大学新生在期末考试周的夹缝里，用 AI 辅助一行行敲出来的个人摄影作品集。
> 不是 SaaS，不是创业项目，就是一个热爱星空摄影的 19 岁少年想拥有一个属于自己的、漂亮的、能给别人看的照片展示站。

**[🌐 bldcam.page](https://bldcam.page)**

---

## ✨ 它能干什么

- 📸 **批量上传** — 拖一坨照片进去，自动走完整流水线（压缩 → EXIF 提取 → BlurHash 占位图 → 存 R2 → 写数据库）
- 🤖 **AI 帮你起名** — 豆包视觉模型看图说话，自动给照片起一个有诗意的标题 + 命中 8 大分类之一
- 🌊 **双视图切换** — 瀑布流（Pinterest 那种）和单列流（适合慢慢看），一个按钮随时切
- 🗺️ **3D 地球仪** — 所有带 GPS 坐标的照片都会出现在 MapLibre 地球上，hover 看详情
- 📱 **手机端也能看** — 侧边栏自动变 overlay、照片尺寸自适应、卡片纯粹干净
- 🔍 **城市 + 分类筛选** — 按拍摄城市或 AI 识别的主题分类快速过滤
- 🔐 **极简后台** — 单人管理面板，密码登录，编辑/删除/上传一站式

## 🛠 技术栈

| 层 | 选型 | 为什么 |
|----|------|--------|
| 框架 | Next.js 16 (App Router) | SSR + API 路由一体，少写一半代码 |
| 语言 | TypeScript | 不解释，2026 年不用 TS 说不过去 |
| 样式 | Tailwind CSS v4 + shadcn/ui | 95% 不写 CSS 文件的日子真爽 |
| 数据库 | SQLite + Prisma | 单用户站用 PostgreSQL 是杀鸡用牛刀 |
| 存储 | Cloudflare R2 | 10GB 免费，零出网费，S3 兼容 |
| AI | 豆包 Seed 2.0 (Volcengine Ark) | CoT 视觉模型，一次调用 3 秒出结果 |
| 地图 | MapLibre GL JS | 免费，3D globe 比 Google Maps 好看 100 倍 |
| 部署 | 腾讯云轻量 + PM2 + Nginx | 2核2G Ubuntu，月费 $5，完全掌控 |
| 灯箱 | Yet Another React Lightbox | 省了自己手写 zoom/swipe 的几百行代码 |

## 📁 项目结构

```
src/
├── app/
│   ├── (front)/          # 前台：首页 + 地图
│   │   ├── page.tsx      # SSR 首屏 20 张 + 城市/分类聚合
│   │   └── map/page.tsx  # 3D 地球照片地图
│   ├── admin/            # 后台：上传 + 管理
│   ├── api/              # 7 个 API 端点
│   │   ├── auth/         # 登录/退出
│   │   └── photos/       # CRUD + AI suggest
│   └── globals.css       # 暗色主题变量
├── components/
│   ├── admin/            # 上传队列 + 照片管理列表
│   ├── gallery/          # 瀑布流卡片 + Feed 流 + 灯箱
│   ├── layout/           # Header 胶囊栏 + 侧边栏
│   └── ui/               # 10 个 shadcn 基础组件
├── context/              # 视图模式 (waterfall/feed)
├── features/map/         # MapLibre + Supercluster
├── hooks/                # useImageDisplaySize
├── lib/                  # AI、R2、auth、geocode、prisma
│   └── image/            # 图片流水线：sharp → exifr → blurhash
└── types/                # Photo 类型定义
```

## 🚀 本地跑起来

```bash
# 1. 克隆
git clone https://github.com/OUENMING/bldcam.git
cd bldcam

# 2. 装依赖
npm install

# 3. 复制环境变量模板，填上你的密钥
cp .env.example .env
# 必填：R2_* 系列、ADMIN_PASSWORD、ARK_API_KEY（豆包 AI，可选）

# 4. 初始化数据库
npx prisma db push

# 5. 启动开发服务器
npm run dev

# 6. 打开 http://localhost:3000
# 后台在 http://localhost:3000/admin
```

## 📦 部署到 VPS

```bash
# 本地构建
npm run build

# 打包 (standalone 输出 ~120MB)
# 会上传到 VPS 的 /home/bldcam/
npm run deploy

# VPS 上重启
ssh bldcam 'pm2 restart bldcam'
```

## 🧠 开发笔记

### 踩过的坑

1. **豆包 CoT 模型的 output 不是你想的那样** — `output[0]` 是推理过程，`output[1]` 才是结果。正确姿势：`output.find(o => o.type === "message")`
2. **sharp `fit: "cover"` 会让瀑布流像砖墙** — 每张照片都裁成一样比例，完全丧失了摄影作品的呼吸感。换 `fit: "inside"` 保留原比例，活了
3. **腾讯云 22 端口被拦截** — 折腾了半小时，最后换 2222 端口秒连。云厂商在 22 端口前面架的透明代理是薛定谔的工作状态
4. **rsync `--delete` 把数据库清了** — 没加 `--exclude='dev.db'`，部署脚本直接 wipe 了线上库。好在 10 张照片本地还有，scp 救回来

### 为什么不

- **不用 Vercel** — 虽然一键部署很香，但我想学 Linux/DNS/Nginx，这些技能比点一个按钮值钱
- **不用 Docker** — 单机单进程，不用套娃。出了问题直接 `pm2 logs`，比 `docker compose logs` 快
- **不用 Prisma 7** — 发布不到一个月，断代式 breaking change（`url` 得从 schema 移到 config），线上踩坑没必要
- **不用 Google Maps** — API key 要绑信用卡，MapLibre 免费开源还更好看

## 📝 License

MIT — 随便拿去改、拿去学、拿去做你自己的。

---

*这个项目在 2026 年 6 月的都柏林被敲出来，旁边是一杯冷掉的美式咖啡和一份还没开始写的能源工程作业。*
*如果你也是从零学编程的摄影爱好者，想改什么就改什么，有问题直接提 Issue——虽然我可能也在学怎么修。*
