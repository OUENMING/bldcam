# Cloudflare R2 图床/云存储/文件管理 研究报告

> 数据来源：知乎多轮搜索，2025-2026
> 编译日期：2026-07-08

---

## 一、概述

Cloudflare R2 是 Cloudflare 推出的对象存储服务，核心卖点是**出站流量免费**，与 AWS S3 兼容协议。免费额度：10GB 存储、每月 100 万次 Class A 操作（写入）、1000 万次 Class B 操作（读取），无流量费。对于个人图床和文件分享场景来说，是目前性价比最高的方案之一。

---

## 二、主要方案一览

### 方案 1：Cloudflare ImgBed（MarSeventh 开源）

| 条目 | 说明 |
|------|------|
| GitHub | [MarSeventh/CloudFlare-ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed) |
| 技术栈 | Cloudflare Pages（Vue.js 前端）+ Workers（后端） |
| 存储后端 | 支持 Telegram / R2 / S3 |
| 元数据 | Cloudflare KV |
| 特色 | 上传密码、后台管理、自定义 URL 前缀 |
| Demo | https://cfbed.1314883.xyz/ (password: cfbed) |
| 评价 | "真正做到零成本，连服务器都不需要" —— denishua |

**适用场景**：需要一个完整的图床管理后台，支持多人上传、密码保护。

---

### 方案 2：R2 + PicGo（最流行的组合）

出现在至少 5 篇以上知乎文章中，是目前最主流、最成熟的方案。

**流程**：
1. 在 Cloudflare Dashboard 创建 R2 存储桶
2. 创建 API 令牌（S3 兼容协议）
3. 在 PicGo 中安装 S3 插件，填入 API 凭据
4. 配置完成后即可一键上传

**工具选择**：
- **PicGo**：老牌开源上传工具，支持 S3 协议插件
- **PicList**：PicGo 的现代分支，功能更丰富
- **Obsidian + PicGo**：记笔记时自动上传图片到 R2

**多篇文章提及**：
- denishua（79 赞同）
- 晚阳Crown（57 赞同）
- 团子和蛋糕（7 赞同）

**适用场景**：最轻量、最无感的图床体验，适合写博客、记笔记时使用。

---

### 方案 3：R2-Explorer（Worker 部署的在线文件管理器）

| 条目 | 说明 |
|------|------|
| 部署方式 | Cloudflare Workers（模板一键部署） |
| 功能 | Web UI 浏览、管理 R2 存储桶文件 |
| 提及 | 章鱼猫先生、Asher（16 赞同）、w45sen（5 赞同） |

**代码片段——Workers 提供 R2 公开访问**（来自 Thinkwind）：

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1);
    const object = await env.MY_BUCKET.get(key);
    if (object === null) {
      return new Response('Not Found', { status: 404 });
    }
    return new Response(object.body);
  }
}
```

**适用场景**：需要一个网页端随时管理/查看 R2 文件，方便分享链接。

---

### 方案 4：r2-web（纯前端文件管理平台）

| 条目 | 说明 |
|------|------|
| 来源 | HelloGitHub 第 123 期（58 赞同，2025-06-29） |
| 定位 | 纯前端的在线文件管理平台 for Cloudflare R2 |
| 特点 | 前端实现，无需后端服务器 |

**适用场景**：追求轻量、只前端部署的文件管理。

---

### 方案 5：Lsky Pro（兰空图床）

| 条目 | 说明 |
|------|------|
| 定位 | PHP 开源图床，功能全面 |
| 存储 | 支持本地、云存储、S3（含 R2） |
| 部署 | Docker 可部署 |
| 来源 | "一个功能全面的开源图床！好用！"（20 赞同） |

**适用场景**：需要完整图床功能（相册分类、用户系统、上传策略等），且不介意 PHP 部署。

---

### 方案 6：EasyImage 2.0（简单图床）

| 条目 | 说明 |
|------|------|
| 定位 | 开源图床，无需数据库 |
| 特色 | 文字/图片水印、多文件上传 |
| 存储 | 配合 R2 使用 |

**适用场景**：需要水印功能，希望部署简单。

---

## 三、核心优势（来自用户评价）

| 优势 | 来源 |
|------|------|
| "R2 出站免费，这是核心优势" | Thinkwind（18 赞同） |
| "DigitalOcean Spaces 根本没有免费计划。Cloudflare 的 R2 是永久免费，不需要绑信用卡" | 姚同学（39 赞同） |
| "Cloudflare R2 是 cloudflare 的文件存储方案，免费计划有 10GB 容量" | Asher |
| "为什么推荐 R2？两个字：免费、够用" | 设计虱聊科技 |

对比 AWS S3：S3 出站流量收费，R2 出站免费，这对图床场景（文件被大量访问）至关重要。

---

## 四、注意事项 / 避坑指南

1. **须绑定支付方式**：虽然是免费套餐，但 Cloudflare 要求绑定信用卡/支付方式才能激活 R2（验证身份，不会扣费）
2. **国内访问速度**：r2.dev 域名在国内可能较慢，建议绑定自定义域名并启用 Cloudflare CDN（橙色云朵）加速
3. **第三方免费图床风险**：files.catbox.moe 等免费图床可能跑路，自建 R2 更稳妥
4. **10GB 够不够**：纯图片（摄影原片除外）完全够用，但存视频/大文件可能紧张
5. **A 类操作次数限制**：每月 100 万次写入操作，日常使用够用，但大量小文件上传需注意

---

## 五、文件分享 / 云盘场景

除图床外，R2 也适用于文件分享 / 个人云盘：

- **S3 Browser**（桌面工具）：通过 S3 协议直接管理 R2 文件 —— 広東圆脸（4102 赞同）
- **R2-Explorer**：Worker 部署，浏览器就是云盘 —— w45sen / 量子星
- 结合 r2-web + R2-Explorer 等方案，实现浏览器端文件上传、下载、管理

---

## 六、方法论建议（基于本场研究）

| 需求 | 推荐方案 |
|------|---------|
| 最轻量写博客/笔记 | R2 + PicGo/PicList |
| 需要网页端管理后台 | Cloudflare ImgBed 或 Lsky Pro |
| 需要文件管理/分享 | R2-Explorer 或 r2-web |
| 需要水印/相册 | EasyImage 2.0 或 Lsky Pro |
| 写代码引用 | Workers S3 SDK 直接操作 |

---

## 七、引用来源

| 作者 | 文章标题 | 赞同 | 日期 |
|------|---------|------|------|
| denishua | 零成本，无需服务器！使用 CloudFlare R2 + Pages 搭建永久免费图床 | 20 | 2025-07-06 |
| Thinkwind | 建了500个站的总结：Cloudflare免费全家桶 | 18 | 2026-05-01 |
| 姚同学 | （未记录） | 39 | - |
| 広東圆脸 | （未记录） | 4102 | - |
| 晚阳Crown | （未记录） | 57 | - |
| HelloGitHub | 第123期 r2-web | 58 | 2025-06-29 |
| 量子星 | （未记录） | - | 2026-07-08（近期） |
