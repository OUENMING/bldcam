# BLDcam 分享图渲染引擎 — v12 完整代码

> 最后更新: 2026-07-24
> 当前缓存 key: `classic-v12`

---

## 文件结构

```
src/lib/share.ts                         ← 核心合成引擎 (515行)
src/lib/r2.ts                            ← R2 缓存 key 生成
src/app/api/photos/[id]/share/route.ts   ← 分享图 API 端点
src/components/gallery/share-dialog.tsx  ← 分享图弹窗 (前端)
src/components/gallery/photo-actions.tsx ← 详情页"生成分享图"按钮
src/components/gallery/photo-lightbox.tsx← 灯箱工具栏按钮
src/app/api/photos/route.ts              ← DELETE 清理 share 缓存
```

---

## 文件: `src/lib/share.ts`

### CLASSIC_THEME — 所有视觉参数

```typescript
export const CLASSIC_THEME = {
  canvas: {
    width: 1440,
    padding: 90,
    radius: 24,
    textBarH: 120,     // [如果加签名: 可能需要增大到~160以容纳多行]
  },
  background: { blur: 52, scale: 1.08, brightness: 0.88, saturation: 0.90 },
  overlay: { rgb: "8,10,8", alpha: 0.06 },
  shadow: {
    ring1: { stdDev: 2,  offsetY: 4,  opacity: 0.25  },  // 接触阴影
    ring2: { stdDev: 8,  offsetY: 14, opacity: 0.09  },  // 环境阴影
    ring3: { stdDev: 24, offsetY: 34, opacity: 0.035 },  // 消散阴影
  },
  typography: {
    brandSize: 52, paramSize: 24, paramGap: 18,
    brandFont: `system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif`,
    paramFont: `'Helvetica Neue',Arial,sans-serif`,
    brandWeight: 800, paramWeight: 400, paramOpacity: 0.80,
  },
  output: { quality: 92 },
} as const;
```

### Layout 接口

```typescript
interface Layout {
  canvasW: number; canvasH: number;
  cardW: number;   cardH: number;
  padX: number;    padTop: number;
  textBarH: number;
  textCenterY: number;  // [签名相关: 签名位置可以基于此计算]
  radius: number;
}
```

### 布局引擎

```typescript
function computeLayout(photoW, photoH, theme) {
  const aspect = photoW / photoH;
  const cardW = theme.canvas.width - 2 * theme.canvas.padding;   // 1260px
  const cardH = Math.round(cardW / aspect);                       // 严格原比例
  const canvasH = theme.canvas.padding + cardH + theme.canvas.textBarH + theme.canvas.padding;
  // 即: canvasH = padding + cardH + textBarH + padding

  return {
    canvasW: theme.canvas.width, canvasH,
    cardW, cardH,
    padX: theme.canvas.padding, padTop: theme.canvas.padding,
    textBarH: theme.canvas.textBarH,
    textCenterY: padding + cardH + Math.round(textBarH * 0.55),   // [签名y坐标参照]
    radius: theme.canvas.radius,
  };
}
```

### EXIF 文字 SVG — `buildExifTextSvg()`

```typescript
// 生成 <svg> 字符串，sharp 渲染为 PNG
// 在 renderComposite 中叠加到 canvas 上 (top: padTop + cardH, left: 0)
//
// [加签名方案 A: 在这里直接追加签名 SVG 元素]
//   在 `</text>` 后增加 `<image href="data:image/svg+xml;base64,..."/>`
//   签名位置: x=canvasW/2, y=textBarH_after_offset (如 textBarH * 0.78)
//   ✅ 影响范围小，只改这里
//
// [加签名方案 B: 新增 TypographyRenderer2 (签名层)]
//   在 renderComposite 中增加第5层: signature layer
//   ✅ 模块化好，可独立开关
//   需要: 修改 renderComposite + generateShareImage

function buildExifTextSvg(canvasW, textBarH, photo, theme) {
  const ty = theme.typography;
  const brand = brandDisplayName(photo.make);
  const segs = buildExifSegments(photo);
  const displayBrand = brand || segs.length ? (brand ?? "BLDcam") : "BLDcam";

  const cx = Math.round(canvasW / 2);
  const y = Math.round(textBarH / 2);  // dominant-baseline="central"

  const brandSpan = `<tspan font-family="${ty.brandFont}" font-weight="${ty.brandWeight}" font-size="${ty.brandSize}">${esc(displayBrand)}</tspan>`;

  const paramSpans = segs.map((s, i) =>
    `<tspan dx="${ty.paramGap}" font-family="${ty.paramFont}" font-weight="${ty.paramWeight}" font-size="${ty.paramSize}" opacity="${ty.paramOpacity}">${esc(s.text)}</tspan>`
  ).join("");

  return `<svg width="${canvasW}" height="${textBarH}">
    <text x="${cx}" y="${y}" fill="#ffffff" text-anchor="middle" dominant-baseline="central">
      ${brandSpan}${paramSpans}
    </text>
    // [方案A: 签名 SVG 追加在此]
    // <image href="data:image/svg+xml;base64,..." x="..." y="..." />
  </svg>`;
}
```

### 照片+阴影渲染 — `renderPhoto()`

```typescript
// 返回: 带 squircle 圆角 + feDropShadow 阴影的照片 PNG
// 不影响签名
async function renderPhoto(imageBuffer, layout, theme) {
  // 1. 修复 EXIF 旋转
  const oriented = await sharp(imageBuffer).rotate().toBuffer();
  // 2. fit:inside 缩放 (保持比例，小照片不放大)
  const resized = await sharp(oriented).resize(cardW, cardH, { fit: "inside", ... }).toBuffer();
  // 3. 实际宽高 (可能 < cardW/cardH)
  const aW = meta.width, aH = meta.height;
  // 4. SVG: squircle clipPath + 3-ring feDropShadow filter
  //    <g transform="translate(offX, offY)">...</g>
}
```

### 合成管线 — `renderComposite()`

```typescript
// [签名相关: 需要在这里加一层]
// 当前 3 层:
//   overlay → photoCard → typography
// 已修改 4 层:
//   overlay → photoCard → typography → [签名 SVG PNG]

async function renderComposite(bg, overlay, photoCard, typography, layout, theme) {
  const layers = [];
  if (overlay) layers.push({ input: overlay, top: 0, left: 0 });
  layers.push({ input: photoCard, top: layout.padTop, left: layout.padX });
  layers.push({ input: typography, top: layout.padTop + layout.cardH, left: 0 });
  // [加签名] layers.push({ input: signatureBuf, top: ..., left: ... });
  return sharp(bg).composite(layers).png(...).toBuffer();
}
```

### 主入口 — `generateShareImage()`

```typescript
// [加签名: 需要 await renderSignature() 加入 Promise.all, 传入 renderComposite]
export async function generateShareImage(photo, imageBuffer, theme) {
  const layout = computeLayout(meta.width, meta.height, theme);

  const [bg, overlay, photoCard, typography] = await Promise.all([
    renderBackground(...),  renderOverlay(...),
    renderPhoto(...),       renderTypography(...),
    //  [签名] renderSignature(layout, photo, theme),
  ]);

  const buffer = await renderComposite(bg, overlay, photoCard, typography, layout, theme);
  //  [签名] 改为 (..., signature, layout, theme)
  return { buffer, layout };
}
```

---

## 文件: `src/lib/r2.ts` (缓存 key)

```typescript
export function getShareKey(photoId: string): string {           // legacy v1
  return `share/${photoId}/classic.png`;
}
export function getShareKeyV2(photoId: string): string {         // current
  return `share/${photoId}/classic-v12.png`;
}
// [加签名后: bump 到 v13 即可，无需改结构]
```

---

## 文件: `src/components/gallery/share-dialog.tsx`

```tsx
// [签名相关: 不需要改]
// 签名是服务端 sharp 合成的，前端只展示最终 PNG
// 但需要增加 textBarH 弹窗空间 → 自适应(已有 max-h-82svh 约束)
```

---

## 文件: 前端按钮 (photo-lightbox.tsx / photo-actions.tsx)

```tsx
// [签名相关: 不需要改]
// 按钮只触发 API 调用，不关心图片内容
```

---

## 文件: `src/app/api/photos/route.ts` (DELETE 清理)

```typescript
// [签名相关: 不需要改]
keys.push(getShareKey(id));    // 清理旧缓存
keys.push(getShareKeyV2(id));  // 清理新版缓存
```

---

## 加 SVG 签名 — 影响范围评估

### 方案 A: 在 `buildExifTextSvg()` 内追加 (最小改动)

**改动**: 只改 `buildExifTextSvg` 1 个函数

```diff
  return `<svg width="..." height="..." xmlns="http://www.w3.org/2000/svg">
    <text ...>${brandSpan}${paramSpans}</text>
+   <image href="data:image/svg+xml;base64,${SIGNATURE_BASE64}" x="..." y="..."/>
  </svg>`;
```

**优点**: 改动最小，只需 1 处修改
**代价**: 签名位置依赖 textBarH；签名 SVG 尺寸需硬编码

### 方案 B: 新增 `renderSignature()` 独立渲染器 (推荐)

**改动**: 3 处

| 文件 | 改动 |
|------|------|
| `src/lib/share.ts` | 新增 `renderSignature()` + 改 `renderComposite` + 改 `generateShareImage` |
| 其他 | 无 |

```typescript
// 新增函数
async function renderSignature(layout, theme): Promise<Buffer | null> {
  // 1. 加载签名 SVG (从文件或 base64)
  // 2. 调整大小放到 footer 区域
  // 3. 返回 PNG buffer (或 null 表示不显示)
}

// renderComposite 增加
layers.push({ input: signature, top: padTop + cardH + textBarH - signatureH, left: ... });

// generateShareImage 增加
const [..., signature] = await Promise.all([..., renderSignature(layout, theme)]);
```

**优点**: 模块化，可独立开关签名，不影响现有排版
**代价**: 多 1 次 sharp 渲染 (约 200ms)

### 方案 C: 在 Typography buffer 后 composite 签名

**改动**: 只改 `renderComposite` (1 处)

```typescript
// 在 composite 里再叠一层
layers.push({ input: signatureBuf, top: padTop + cardH + Math.round(textBarH * 0.65), left: Math.round(canvasW / 2) });
```

**优点**: 不改管线结构，比 A 干净
**代价**: 签名位置依赖 textBarH

### 建议选择: **方案 B**

你现在 footer 高度 120px 只放了单行文字，空间充足。签名放在品牌名下方 8-12px 处，高度约 24-32px。加后 textBarH 建议调整为 140-150px。

### 需要准备的材料

1. 你的 SVG 签名文件（或 base64 字符串）
2. 签名尺寸（宽 × 高 px）
3. 签名在 footer 中的位置（居中？右对齐？）
