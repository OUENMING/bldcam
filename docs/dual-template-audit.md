# 双模板分享图 (classic + signature) — 变更审计文档

> 生成时间: 2026-07-24 · commit `015c3d56`

---

## 1. 直接改动的文件

### 1.1 `src/lib/share.ts` (核心引擎)

**改动量**: +126 行 / -12 行

**新增符号**:

| 符号 | 类型 | 位置 | 说明 |
|------|------|------|------|
| `SIGNATURE` | `const` | L125–136 | 签名视觉参数 (heightRatio=0.55, svgPath, 颜色映射, brightnessThreshold) |
| `isFooterAreaDark(bg, layout)` | `async function` | L456–469 | `sharp.stats()` 分析背景底部亮度 |
| `renderSignature(layout, isDarkBg)` | `async function` | L471–527 | 读取 SVG → 自适应颜色 → 缩放 → 居中合成 |

**修改的函数**:

| 函数 | 变更 |
|------|------|
| `generateShareImage(photo, imageBuffer, theme, template)` | 新增第4参数 `template`；管线拆分：背景先渲染 → 分支渲染 footer 层 → 其余并行 |

**新增 import**:
```typescript
import { readFile } from "fs/promises";
import path from "path";
```

### 1.2 `src/lib/r2.ts` (缓存 key)

| 函数 | 旧签名 | 新签名 |
|------|--------|--------|
| `getShareKeyV2(photoId)` | returns `share/{id}/classic-v12.png` | → `getShareKeyV2(photoId, template)` 默认 `"classic"`，签名用 `share/{id}/signature-v12.png` |

### 1.3 `src/app/api/photos/[id]/share/route.ts` (分享图 API)

| 区域 | 变更 |
|------|------|
| `GET` handler | 新增 `?template=` 查询参数解析 + 校验；`generateShareImage` 传入 `template` |
| R2 cache key | `getShareKeyV2(id, template)` |

### 1.4 `src/app/api/photos/route.ts` (照片 DELETE)

| 区域 | 变更 |
|------|------|
| `DELETE` handler | 清理 `getShareKeyV2(id, "classic")` + `getShareKeyV2(id, "signature")` 两套缓存 |
| imports | 移除未使用的 `getShareKey` |

### 1.5 `src/components/gallery/share-dialog.tsx` (前端弹窗)

| 区域 | 变更 |
|------|------|
| State | 新增 `template: "classic" \| "signature"`, `fadeIn: boolean` |
| `fetchShareImage()` | 接受 `tpl` 参数，URL 携带 `?template=` |
| `handleCopyLink()` | 复制链接含 `?template=` |
| UI | 新增分段控制器 (经典 EXIF / 艺术签名) + 图片淡入过渡 |

### 1.6 `public/signature.svg` (新建)

签名矢量文件，`viewBox="0 0 1000 1200"`，内容分两层：
- **Path 1** (`fill="#ffffff"`): 主 logo 图形，Y 范围 ~475–575
- **Path 2** (`fill="#999999"`): 副标题/URL 文本，Y 范围 ~642–650

---

## 2. 受影响的现有文件 (间接依赖)

| 文件 | 受影响原因 |
|------|-----------|
| `src/components/gallery/photo-lightbox.tsx` | 灯箱工具栏中 share 按钮 → 打开 ShareDialog，间接使用新模板 |
| `src/components/gallery/photo-actions.tsx` | 详情页分享按钮 → 打开 ShareDialog |
| `src/components/gallery/photo-grid.tsx` | 相册网格中使用 ShareDialog |
| `src/lib/image/pipeline.ts` | 照片上传管线 — 无直接改动，但分享图依赖其产生的 R2 URL |
| `docs/bldcam-share-card-code-v12.md` | 参考文档，已过时 (现在是 v12+signature) |

---

## 3. 部署制品验证

| 文件 | VPS 路径 | 存在 |
|------|----------|------|
| `public/signature.svg` | `/home/bldcam/public/signature.svg` | ✅ |
| `src/lib/share.ts` | `/home/bldcam/.next/server/app/api/photos/[id]/share/route.js` (编译后) | ✅ |
| `share-dialog.tsx` | `/home/bldcam/.next/server/chunks/ssr/...` (编译后) | ✅ |

---

## 4. 当前已知问题

### Bug 1: Classic EXIF 分享图生成失败

- **症状**: 访问 `/api/photos/{id}/share` (经典) 返回错误
- **排查方向**: `renderTypography` 是否在重构后正常调用；VPS 日志

### Bug 2: Signature 签名过小

- **原因**: SVG viewBox 1000×1200，约束高度 66px (textBarH 120px × 0.55) → 宽度 = 55px，在主 canvas 1440px 上不可见
- **修复方向**: 调整 SVG viewBox 裁切到实际内容区域 (Y ~460–660)，使有效宽高比从 0.83:1 变为 ~5:1

---

## 5. 完整文件树

```
src/
├── lib/
│   ├── share.ts          ← 修改 (+126)
│   └── r2.ts             ← 修改 (+4/-1)
├── app/
│   └── api/
│       └── photos/
│           ├── route.ts                         ← 修改 (+4/-5)
│           └── [id]/
│               └── share/
│                   └── route.ts                 ← 修改 (+16/-5)
└── components/
    └── gallery/
        └── share-dialog.tsx                     ← 修改 (+70/-10)
public/
└── signature.svg                                 ← 新建
```
