# BLDcam — 影集

> Claude + DeepSeek · 真正的性价比和事半功倍

**[bldcam.page](https://bldcam.page)**

---

## 功能

- **批量上传** — 拖一坨照片进去，自动走完整流水线（压缩 → EXIF 提取 → BlurHash 占位图 → 存 R2 → 写数据库）
- **AI 帮你起名** — 豆包视觉模型看图说话，自动给照片起标题 + 命中分类
- **双视图切换** — 瀑布流和单列流，高性能切换
- **3D 地球仪** — 所有带 GPS 坐标的照片都会出现在 MapLibre 地球上，hover 看详情
- **手机端也能看** — 侧边栏自动变 overlay、照片尺寸自适应、纯粹干净
- **城市 + 分类筛选** — 按拍摄城市或 AI 识别的主题分类快速过滤
- **极简后台** — 单人管理面板，密码登录，编辑/删除/上传一站式

## 技术栈

| 分类 | 选型 | 说明 |
|------|------|------|
| 框架 | Next.js 16 (App Router) | SSR + API 路由一体，少写一半代码 |
| 语言 | TypeScript | 类型安全，少踩坑 |
| 样式 | Tailwind CSS v4 + shadcn/ui | 不想写 CSS |
| 数据库 | SQLite + Prisma | 简单好维护，单用户够用 |
| 存储 | Cloudflare R2 | 10GB 免费，零出网费，S3 兼容 |
| AI | 豆包 Seed 2.0 (Volcengine Ark) | CoT 视觉模型，一次调用 3 秒出结果 |
| 地图 | MapLibre GL JS | 免费，3D globe 比 Google Maps 好看 |
| 部署 | 腾讯云轻量 + PM2 + Nginx | ~$5/月，学到的技能更通用 |
| 灯箱 | Yet Another React Lightbox | 感谢开源 |

## 项目结构

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

## 本地测试

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

## 部署

```bash
# 本地构建 + 一键部署
npm run build
bash deploy.sh
```

## 开发笔记

1. **豆包 CoT 模型的 output** 在 `output.find(o => o.type === "message")`，不能直接取 `output[0]`
2. **Sharp** 用 `fit: "inside"` 保留原比例，别用 `fit: "cover"`——否则瀑布流像砖墙一样死板
3. **腾讯云 22 端口被拦截** — 换 2222 端口连接
4. **rsync `--delete` 把数据库清了** — 必须加 `--exclude='dev.db'`

## 项目总结

详见 [docs/项目总结.md](docs/项目总结.md) — 完整时间线、13 个难点、经验教训。

---

完
