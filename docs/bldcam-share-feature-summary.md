# BLDcam — 分享图功能开发阶段总结

> 生成日期: 2026-07-24
> 阶段跨度: 7月23日 下午 ~ 7月24日 下午 (约 24 小时)
> 累计 commit: 15+ 次

---

## 一、功能目标

为 BLDcam 摄影作品集实现：
1. **分享图生成** — 服务端 Sharp 合成品牌分享卡片（毛玻璃背景 + 悬浮照片 + EXIF 信息）
2. **原图下载** — `/api/photos/[id]/download` 附件下载
3. **前端集成** — 灯箱/详情页操作入口 + 分享弹窗

---

## 二、已完成功能

### 2.1 后端

| 功能 | 文件 | 说明 |
|------|------|------|
| 分享图生成引擎 | `src/lib/share.ts` | Sharp 合成管线 |
| 分享图 API | `src/app/api/photos/[id]/share/route.ts` | GET，R2 缓存 + 生成 + 返回 |
| 下载 API | `src/app/api/photos/[id]/download/route.ts` | GET，Content-Disposition |
| R2 缓存 | `src/lib/r2.ts` | `getShareKeyV2()` 确定性 key |
| DELETE 联动 | `src/app/api/photos/route.ts` | 删照片同时删 share 缓存 |

### 2.2 前端

| 功能 | 文件 | 说明 |
|------|------|------|
| 详情页按钮 | `src/components/gallery/photo-actions.tsx` | 下载原图 + 生成分享图 |
| 分享弹窗 | `src/components/gallery/share-dialog.tsx` | 加载/错误/就绪三态 + 下载/复制链接 |
| 灯箱按钮 | `src/components/gallery/photo-lightbox.tsx` | YARL 工具栏插槽（`LightboxDownloadButton` / `LightboxShareButton`） |
| 灯箱图片约束 | `photo-lightbox.tsx` CustomSlide | `max-h-[90svh]` + `max-w-[90vw]` 防溢出 |
| ShareDialog 状态 | `src/components/gallery/photo-grid.tsx` | `onShare` 回调 + `ShareDialog` 实例 |

---

## 三、视觉设计演化（12 个版本）

| 版本 | 改动 | 状态 |
|------|------|------|
| v1 | 初始 Sharp 合成 | initial |
| v2 | R2 缓存 | ✅ |
| v3 | 模块化重写 + Theme 系统 | 丢弃 |
| v4 | 背景 scale 1.08 + saturation 0.90 | 丢弃 |
| v5 | 删除深绿暗角 | 丢弃 |
| v6 | 灯箱按钮 + 工具栏 | ✅ |
| v7 | 三层光学阴影 contact/ambient/falloff | ❌ 模糊黑矩形 |
| v8 | 移除 `fill-opacity` 修复 XML 解析 | ✅ |
| v9 | textCenterY 55% | ❌ 未生效 |
| v10 | **实际生效** textCenterY + `dominant-baseline` | ✅ |
| v11 | SVG `feDropShadow` 真高斯阴影 | ✅ |
| v12 | **最终版** (squircle圆角 + 品牌sans + 灯箱约束) | ✅ |

### 当前最终设计 (v12)

| 组件 | 技术 |
|------|------|
| 画布 | 1440px 固定宽 / 高度动态 |
| 照片 | `fit:inside` + `rotate()` 修复 EXIF |
| 圆角 | Squircle 连续曲率 (cubic bezier, 系数 0.45) |
| 阴影 | SVG `feDropShadow` 3 层链式滤镜 (真高斯) |
| 背景 | `cover` scale 1.08 + blur 52 + brightness 0.88 + saturation 0.90 |
| 覆盖层 | rgba(8,10,8,0.06) 色调统一 |
| Footer | 120px 高 + 品牌/EXIF 居中 + `dominant-baseline="central"` |
| 品牌字 | `system-ui` sans-serif bold 800 |
| EXIF 字 | `Helvetica Neue` sans-serif regular 400, opacity 0.80 |
| 缓存 key | `classic-v12` |

---

## 四、Bug 与事故完整记录

### Bug 1: SVG XML 解析错误
**症状**: `Error domain 1 code 76: Opening and ending tag mismatch: svg line 1 and text`
**根因**: librsvg 不识别 `<tspan fill-opacity="0.9">` + `dominant-baseline="central"`
**修复**: 移除 `fill-opacity`, 用 `opacity` 替代; 移除 `dominant-baseline`

### Bug 2: Photo 双重编码降质
**路径**: `WebP(q85) → base64 → SVG → sharp 渲染`
**修复**: 链式调用 PNG 编码

### Bug 3: textCenterY 未生效
**原因**: `buildExifTextSvg()` 一直用局部变量 `textBarH/2`，忽略了 Theme 的 `textCenterY`
**修复**: 两处统一为 `textBarH/2`

### Bug 4: 灯箱图片撑满屏幕
**根因**: `<Image fill>` 没有宽高约束
**修复**: `width/height` + `max-h-[90svh]` + `object-contain`

### Bug 5: 圆角消失（部分照片无圆角）
**根因**: `withoutEnlargement:true` 小照片不放大 → 实际尺寸 < cardW/cardH → 圆角按 cardW 裁 → 碰不到
**修复**: `squirclePath(aW, aH, radius)` 按实际照片尺寸裁切

### Bug 6: EXIF 旋转 (Orientation)
**根因**: 手机竖拍照片 EXIF Orientation=8 未被识别，横纵颠倒
**修复**: `sharp(imageBuffer).rotate()`

### 重大事故: VPS 17 小时离线

**时间线**:
1. 22:00 — 错误 vps-setup 执行 `rm -rf node_modules`
2. 22:10 — `npm install` 完成后 PM2 重启 → Prisma symlink 断裂
3. 22:00~05:22 — 首页正常但 API 500（累计 5000+ 请求）
4. 05:22~06:13 — 用户 4 次重启 VPS（本意修复问题）
5. 06:22~15:25 — 全站离线 9 小时（Nginx 502）
6. 15:25 — 手动修复 Prisma + 部署 v12 → 恢复

**根因链**:
```
vps-setup.sh 加了 rm -rf node_modules (本意是好)
  → 全量 npm install 耗时 9 分钟
  → PM2 强制重启 → Prisma symlink 找不到
  → API 500 但首页 200 (碎片状态)
  → 4 次重启后 PM2 彻底死亡
  → 全站 502 (Nginx 连不上 3000)
```

**修复**:
1. vps-setup.sh 改回只重装 sharp，不删全量 node_modules
2. deploy.sh rsync 排除 `node_modules/` 改为锚点 `--exclude=/node_modules/`
3. Prisma symlink 改硬复制（`.next/node_modules/@prisma/client-xxx`）
4. vps-setup.sh 加入 Prisma 自动修复

---

## 五、当前状态检查 (2026-07-24 16:30)

| 检查项 | 状态 | 备注 |
|--------|------|------|
| 首页 | ✅ 200 | |
| 管理后台 | ✅ 200 | |
| 照片 API | ✅ 200 | |
| 下载 API | ✅ 200 | |
| 分享图 API | ✅ 200 / 307 | 缓存命中 → JSON，浏览器 → 307 跳转 |
| 详情页按钮 | ✅ | 下载原图 + 生成分享图 |
| 灯箱按钮 | ✅ | 工具栏下载 + 分享 |
| 分享弹窗 | ✅ | 加载 → 预览 → 下载PNG / 复制链接 |
| 灯箱图片 | ✅ | 不再撑满屏幕 |
| VPS 磁盘 | 33% (16G/50G) | 健康 |
| PM2 重启 | 1422 次 | 大量来自凌晨事故，已稳定 |
| sharp | ✅ 已安装 | Linux x64 |
| Prisma | ✅ 已修复 | symlink 改为硬复制 |

---

## 六、待办/已知问题

### 待完成

| 事项 | 优先级 | 说明 |
|------|--------|------|
| 加 SVG 签名 | P0 | 设计稿已有签名位置 |
| 清除 1422 次 PM2 重启记录 | P1 | `pm2 delete bldcam && pm2 start` 重置计数 |
| 分享图压缩 | P2 | 当前 ~600KB~900KB，可压缩到 200-300KB |
| 多模板支持 | P3 | 参考 LensBorder-Pro 的 24 模板 |

### 已知问题

| 问题 | 影响 | 原因 |
|------|------|------|
| 某些 Panorama 照片 Footer 下沉 | 美观 | canvasH 比例极端时 textBarH 固定 120px 不变 |
| VPS 每次 deploy 需 Prisma 修复 | 维护 | `.next/node_modules` 的 symlink 在 Linux 上重建 |

---

## 七、文件清单

### 本次新增 (6 文件)

```
src/lib/share.ts                             (515行)   ← 核心引擎
src/app/api/photos/[id]/share/route.ts       (83行)    ← API
src/app/api/photos/[id]/download/route.ts     (49行)    ← API
src/components/gallery/share-dialog.tsx       (148行)   ← 弹窗
src/components/gallery/photo-actions.tsx      (46行)    ← 按钮
src/components/gallery/photo-lightbox.tsx     (272行)   ← 灯箱工具栏
```

### 本次修改 (3 文件)

```
src/lib/r2.ts                                +getShareKeyV2() / getShareUrl()
src/app/api/photos/route.ts                  DELETE 清理 share 缓存
src/components/gallery/photo-grid.tsx         +ShareDialog 状态
```

### 核心依赖

```
sharp                     ^0.35.1   图片处理 (已预装)
yet-another-react-lightbox 3.32.0   灯箱 (已预装)
lucide-react               1.18.0   图标 (已预装)
@aws-sdk/client-s3         3.1068.0 R2 操作 (已预装)
```

---

## 八、关键 Theme 参数速查

```typescript
// CLASSIC_THEME — 用于视觉校准的快速参考
{
  canvas:   { width: 1440, padding: 90, radius: 24, textBarH: 120 },
  shadow:   { ring1: 0.25/2/4,  ring2: 0.09/8/14,  ring3: 0.035/24/34 },
  bg:       { blur: 52, scale: 1.08, brightness: 0.88, saturation: 0.90 },
  overlay:  { alpha: 0.06, rgb: "8,10,8" },
  brand:    { size: 52, font: system-ui, weight: 800 },
  exif:     { size: 24, font: Helvetica, weight: 400, opacity: 0.80 },
  output:   { quality: 92 },
}
```
