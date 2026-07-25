# BLDcam 分享图渲染引擎 — 完整代码

## 文件: `src/lib/share.ts`

### Theme — 所有视觉参数

```typescript
export const CLASSIC_THEME = {
  canvas: {
    width: 1440,       // 画布固定宽度
    padding: 90,       // 照片卡片四周留白
    radius: 24,        // squircle 圆角半径
    textBarH: 120,     // Footer 文字区域高度
  },

  background: {
    blur: 52,          // 高斯模糊 sigma
    scale: 1.08,       // 模糊前放大比例
    brightness: 0.88,  // 亮度倍数
    saturation: 0.90,  // 饱和度倍数
  },

  overlay: {
    rgb: "8,10,8",    // 覆盖层颜色
    alpha: 0.06,       // 覆盖层透明度
  },

  // 三层 SVG feDropShadow — 真高斯阴影 (同 Canvas ctx.shadowBlur)
  shadow: {
    ring1: { stdDev: 2,  offsetY: 4,  opacity: 0.25  },   // 接触阴影
    ring2: { stdDev: 8,  offsetY: 14, opacity: 0.09  },   // 环境阴影
    ring3: { stdDev: 24, offsetY: 34, opacity: 0.035 },   // 消散阴影
  },

  typography: {
    brandSize: 52,       // 品牌名字号
    paramSize: 24,       // EXIF 参数字号
    paramGap: 18,        // 参数间距 (SVG dx)
    brandFont: `'DejaVu Serif','Georgia','Times New Roman',serif`,  // 品牌用衬线
    paramFont: `'Helvetica Neue',Arial,sans-serif`,                 // 参数用无衬线
    brandWeight: 700,    // 品牌粗斜体
    paramWeight: 400,    // 参数常规
    paramOpacity: 0.80,  // 参数透明度
  },

  output: { quality: 92 },
} as const;
```

### 布局引擎

```typescript
function computeLayout(photoW, photoH, theme) {
  const aspect = photoW / photoH;
  const cardW = theme.canvas.width - 2 * theme.canvas.padding;
  const cardH = Math.round(cardW / aspect);             // 严格原比例
  const canvasH = theme.canvas.padding + cardH + theme.canvas.textBarH + theme.canvas.padding;

  return {
    canvasW: theme.canvas.width,
    canvasH,
    cardW, cardH,
    padX: theme.canvas.padding,
    padTop: theme.canvas.padding,
    textBarH: theme.canvas.textBarH,
    textCenterY: theme.canvas.padding + cardH + Math.round(theme.canvas.textBarH * 0.55),
    radius: theme.canvas.radius,
  };
}
```

### Squircle 连续圆角路径

```typescript
function squirclePath(w, h, r) {
  const c = r * 0.45; // 控制点系数 0.45 ≈ Apple squircle
  return `M ${r} 0
    C ${r + c} 0, ${w - c} 0, ${w - r} 0
    C ${w} ${c * 0.55}, ${w} ${r + c}, ${w} ${r}
    L ${w} ${h - r}
    C ${w} ${h - c}, ${w - c} ${h}, ${w - r} ${h}
    L ${r} ${h}
    C ${c} ${h}, 0 ${h - c}, 0 ${h - r}
    L 0 ${r}
    C 0 ${c}, ${c} 0, ${r} 0 Z`;
}
```

### SVG feDropShadow 阴影滤镜 (三层)

```typescript
function buildShadowFilter(theme) {
  const { ring1, ring2, ring3 } = theme.shadow;
  return `<filter id="sh" x="-40%" y="-40%" width="180%" height="180%">
    <feDropShadow dx="0" dy="${ring1.offsetY}" stdDeviation="${ring1.stdDev}" flood-color="#000" flood-opacity="${ring1.opacity}"/>
    <feDropShadow dx="0" dy="${ring2.offsetY}" stdDeviation="${ring2.stdDev}" flood-color="#000" flood-opacity="${ring2.opacity}"/>
    <feDropShadow dx="0" dy="${ring3.offsetY}" stdDeviation="${ring3.stdDev}" flood-color="#000" flood-opacity="${ring3.opacity}"/>
  </filter>`;
}
```

### EXIF 文字 SVG

```typescript
function buildExifTextSvg(canvasW, textBarH, photo, theme) {
  const ty = theme.typography;
  const brand = brandDisplayName(photo.make);      // 品牌名映射
  const segs = buildExifSegments(photo);            // EXIF 参数列表
  const displayBrand = brand || segs.length ? (brand ?? "BLDcam") : "BLDcam";

  const cx = Math.round(canvasW / 2);               // 水平中心
  const y = Math.round(textBarH / 2);               // 垂直中心

  // 品牌 — serif italic bold
  const brandSpan = `<tspan font-family="${ty.brandFont}" font-style="italic" font-weight="${ty.brandWeight}" font-size="${ty.brandSize}">${esc(displayBrand)}</tspan>`;

  // 参数 — sans regular, 每个独立 tspan + dx 间距
  const paramSpans = segs.map((s, i) =>
    `<tspan dx="${ty.paramGap}" font-family="${ty.paramFont}" font-weight="${ty.paramWeight}" font-size="${ty.paramSize}" opacity="${ty.paramOpacity}">${esc(s.text)}</tspan>`
  ).join("");

  return `<svg width="${canvasW}" height="${textBarH}" xmlns="http://www.w3.org/2000/svg">
    <text x="${cx}" y="${y}" fill="#ffffff" text-anchor="middle">
      ${brandSpan}${paramSpans}
    </text>
  </svg>`;
}
```

### 照片 + 阴影渲染

```typescript
async function renderPhoto(imageBuffer, layout, theme) {
  const { cardW, cardH, radius } = layout;

  // 缩放照片 (fit:inside 保持比例)
  const resized = await sharp(imageBuffer)
    .resize(cardW, cardH, { fit: "inside", withoutEnlargement: true })
    .png().toBuffer();

  const meta = await sharp(resized).metadata();
  const aW = meta.width, aH = meta.height;
  const offX = Math.round((cardW - aW) / 2);
  const offY = Math.round((cardH - aH) / 2);
  const base64 = resized.toString("base64");

  // SVG: squircle clipPath + feDropShadow filter + image
  const filter = buildShadowFilter(theme);
  const clipPath = squirclePath(cardW, cardH, radius);
  const svg = `<svg width="${cardW}" height="${cardH}">
    <defs>
      <clipPath id="cr"><path d="${clipPath}"/></clipPath>
      ${filter}
    </defs>
    <image href="data:image/png;base64,${base64}"
           x="${offX}" y="${offY}" width="${aW}" height="${aH}"
           clip-path="url(#cr)" filter="url(#sh)"/>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
```

### 背景渲染

```typescript
async function renderBackground(imageBuffer, layout, theme) {
  const { scale, blur, brightness, saturation } = theme.background;

  const bgW = Math.round(layout.canvasW * scale);
  const bgH = Math.round(layout.canvasH * scale);
  const offX = Math.round((bgW - layout.canvasW) / 2);
  const offY = Math.round((bgH - layout.canvasH) / 2);

  return sharp(imageBuffer)
    .resize(bgW, bgH, { fit: "cover", position: "centre" })
    .extract({ left: offX, top: offY, width: layout.canvasW, height: layout.canvasH })
    .blur(blur)
    .modulate({ brightness, saturation })
    .png().toBuffer();
}
```

### 合成管线

```typescript
async function renderComposite(bg, overlay, photoCard, typography, layout, theme) {
  const layers = [];

  if (overlay) layers.push({ input: overlay, top: 0, left: 0 });

  // 照片卡片 (阴影已嵌入 SVG)
  layers.push({ input: photoCard, top: layout.padTop, left: layout.padX });

  // EXIF 文字 (紧贴照片底边)
  layers.push({ input: typography, top: layout.padTop + layout.cardH, left: 0 });

  return sharp(bg).composite(layers).png({ quality: theme.output.quality }).toBuffer();
}
```

### 主入口

```typescript
export async function generateShareImage(photo, imageBuffer, theme = CLASSIC_THEME) {
  const meta = await sharp(imageBuffer).metadata();
  const layout = computeLayout(meta.width ?? 1200, meta.height ?? 800, theme);

  const [bg, overlay, photoCard, typography] = await Promise.all([
    renderBackground(imageBuffer, layout, theme),
    renderOverlay(layout, theme),
    renderPhoto(imageBuffer, layout, theme),
    renderTypography(layout, photo, theme),
  ]);

  const buffer = await renderComposite(bg, overlay, photoCard, typography, layout, theme);
  return { buffer, layout };
}
```

---

## 文件: `src/components/gallery/photo-lightbox.tsx`

### 灯箱图片约束

```tsx
function CustomSlide({ slide }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center p-4">
      <div className="relative max-h-[92svh] max-w-[92vw]">
        <Image
          src={slide.src}
          alt={slide.title}
          width={slide.width}
          height={slide.height}
          placeholder={slide.blurDataUrl ? "blur" : "empty"}
          blurDataURL={slide.blurDataUrl ?? undefined}
          priority
          unoptimized
          onLoad={() => setLoaded(true)}
          className={cn(
            "max-h-[90svh] max-w-[90vw] object-contain",
            loaded ? "opacity-100" : "opacity-0",
          )}
          sizes="90vw"
        />
      </div>

      {/* EXIF overlay (底部标题 + 参数) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/80 px-4 pt-10 text-center md:px-6"
           style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <h2 className="mb-0.5 font-semibold text-white text-sm">{slide.title}</h2>
        {/* EXIF items: 相机, 光圈, 快门, ISO, 焦距, 日期 */}
        {exifItems.map(item => (
          <span className="inline-flex items-baseline gap-1 text-xs">
            <span className="text-white/40">{item.label}</span>
            <span className="text-white/80">{item.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
```

### YARL 工具栏按钮 (下载 + 分享)

```tsx
function LightboxDownloadButton() {
  const { slides, currentIndex } = useLightboxState();
  const slide = slides[currentIndex];
  return (
    <a href={`/api/photos/${slide.id}/download`} download className="yarl__button"
       title="下载原图">
      <Download className="h-4 w-4" />
    </a>
  );
}

function LightboxShareButton({ onShare }) {
  const { slides, currentIndex } = useLightboxState();
  const slide = slides[currentIndex];
  return (
    <button className="yarl__button" title="生成分享图"
            onClick={() => onShare?.(slide.id)}>
      <Share2 className="h-4 w-4" />
    </button>
  );
}
```

### 工具栏配置

```tsx
<Lightbox
  toolbar={{ buttons: [
    <LightboxDownloadButton key="download" />,
    <LightboxShareButton key="share" onShare={onShare} />,
    'close',
  ]}}
  ...
/>
```

---

## 技术亮点总结

| 组件 | 技术 |
|------|------|
| **阴影** | SVG `feDropShadow` 三层 chained filter — 真高斯 (同 Canvas ctx.shadowBlur) |
| **圆角** | Squircle 路径 cubic bezier — Apple 式连续曲率 (控制点 0.45) |
| **排版** | 品牌名 serif (衬线) + EXIF sans (无衬线) 独立字体栈 |
| **布局** | Canvas 1440px 固定宽 + `fit:inside` 保持原比例 |
| **缓存** | `classic-v9` key, R2 云端缓存, Node.js SDK 清缓存 |
