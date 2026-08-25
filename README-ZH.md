# OpenScene

[English](./README.md) | 简体中文

OpenScene 是一套现代化的、可自部署的可视化内容编排与页面搭建系统。基于 **JSON Render + 独立 Studio 编辑器 + 框架适配器（UI Adapter）** 架构设计，支持跨框架（React / Solid / Vue）、跨端业务组件无缝接入与低代码可视化搭建。

---

## 目录结构

```text
openscene/
├── apps/
│   ├── admin/       # @openscene-ai/admin: Next.js 管理后台服务 (多 App、页面版本发布、素材库、Studio 会话)
│   ├── studio/      # @openscene-ai/studio: React SPA 可视化画布编辑器
│   └── docs/        # @openscene-ai/docs: 官方文档站点 (Astro / Nimbus)
├── packages/
│   ├── sdk/
│   │   ├── react/        # @openscene-ai/react: React 19 UI Adapter 与运行时组件库
│   │   ├── solid/        # @openscene-ai/solid: SolidJS UI Adapter
│   │   └── javascript/   # @openscene-ai/javascript: 框架中立的运行时 Client 与 Vite Manifest 插件
│   ├── protocol/         # @openscene-ai/protocol: 协议定义、Document Schema、Bridge 规范
│   ├── schema/           # @openscene-ai/schema: 样式、尺寸、OpenAPI 契约定义
│   ├── constants/        # @openscene-ai/constants: 共享常量与状态定义
│   └── api-client/       # @openscene-ai/api-client: 自动生成的 Admin REST API Client
├── examples/
│   ├── react-vite/       # React 19 + Vite 业务接入示例
│   └── solid-v1/         # SolidJS + Vite 业务接入示例
└── docs/                 # 详细集成与部署指南
```

---

## 快速上手与本地开发

本项目采用统一前端工具链 **Vite+ (`vp`)** 与 **Bun** 作为包管理器。

### 1. 环境准备

- **Node.js**: `>= 22.18.0`
- **Vite+ / Bun**: `bun >= 1.4.0`

```bash
# 全局安装 Vite+ (若未安装)
npm install -g vite-plus

# 安装依赖并链接 Workspace
vp install

# 运行全量代码检查与构建准备
vp run ready
```

### 2. 本地全链路联调启动

本地开发通常需要同时启动三个服务：

```bash
# 终端 1：启动 Admin 服务 (默认端口 3000)
vp -C apps/admin dev

# 终端 2：启动 Studio 画布编辑器 (默认端口 5173)
vp -C apps/studio dev

# 终端 3：启动业务渲染端 (以 React 示例为例，指定端口 5174)
vp -C examples/react-vite dev -- --port 5174
```

启动后：

1. 访问 `http://localhost:3000` 进入 Admin 后台。
2. 在应用下的 **Preview profiles（预览配置）** 中配置 `http://localhost:5174/` 为默认预览地址。
3. 在页面详情点击 **Open in Studio**，即可在 Studio 中实时拖拽编排并双向预览 React 组件。

---

## 部署 Admin 服务 (`apps/admin`)

`apps/admin` 是一个全栈 **Next.js** 应用，包含管理后台 UI、RESTful Management API、Runtime 交付接口及 Studio 会话授权。

### 1. 环境变量配置 (`.env`)

复制 `apps/admin/.env.example` 为 `.env` 并配置生产参数：

```bash
# 1. 数据库连接 (支持本地 SQLite 或远程 LibSQL/Turso)
OPENSCENE_DATABASE_URL=file:./data/openscene.db
OPENSCENE_DATABASE_AUTH_TOKEN=

# 2. 身份认证与会话秘钥 (必须使用随机生成的长字符串)
BETTER_AUTH_SECRET=your-random-32-character-secret-key-here
BETTER_AUTH_URL=https://admin.yourdomain.com

# 3. 部署服务公网地址
OPENSCENE_API_PUBLIC_BASE_URL=https://admin.yourdomain.com
OPENSCENE_STUDIO_PUBLIC_BASE_URL=https://studio.yourdomain.com

# 4. 敏感数据与凭证加密秘钥 (S3 密钥、AI Provider API Key 加密)
OPENSCENE_ENCRYPTION_KEY=your-secure-encryption-key-for-secrets

# 5. 会话与上传限制
OPENSCENE_SESSION_TTL_SECONDS=1800
OPENSCENE_UI_SESSION_TTL_SECONDS=28800
OPENSCENE_MAX_UPLOAD_BYTES=52428800
OPENSCENE_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,image/gif,application/pdf
```

### 2. 数据库迁移

Admin 支持自动运行数据库迁移，也可在发布流水线中显式执行：

```bash
cd apps/admin
vp run migrate
```

### 3. 构建与启动

#### 方式 A：Node.js / PM2 直接运行

```bash
# 1. 构建全量 Workspace
vp run build

# 2. 启动 Admin 生产服务
cd apps/admin
next start -p 3000
```

使用 PM2 守护进程配置示例 (`ecosystem.config.cjs`)：

```js
module.exports = {
  apps: [
    {
      name: "openscene-admin",
      cwd: "./apps/admin",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
```

#### 方式 B：Docker 容器化部署

在项目根目录构建 Docker 镜像：

```dockerfile
FROM oven/bun:1.4-alpine AS base
WORKDIR /app

# 安装依赖
COPY package.json bun.lock ./
COPY packages ./packages
COPY apps ./apps
COPY examples ./examples
RUN bun install --frozen-lockfile

# 构建生产产物
RUN bun run build

# 运行镜像
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=base /app/apps/admin/.next/standalone ./
COPY --from=base /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=base /app/apps/admin/public ./apps/admin/public

EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
```

---

## 部署 Studio 编辑器 (`apps/studio`)

`apps/studio` 是一个纯客户端 **React SPA**，完全无状态，通过 API 与 Admin 交互并通过 Bridge 协议驱动业务 iframe。

### 1. 构建产物

```bash
# 构建 Studio 静态资源
vp -C apps/studio build
```

构建完成后，静态文件将输出到 `apps/studio/dist` 目录。

### 2. 静态托管与 Nginx 配置

将 `apps/studio/dist` 部署到任意静态托管平台（如 Nginx、Cloudflare Pages、Vercel、AWS S3 + CloudFront 等）。

#### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name studio.yourdomain.com;

    # 开启 gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    root /var/www/openscene-studio/dist;
    index index.html;

    # SPA 路由 fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源长期缓存
    location ~* \.(?:ico|css|js|gif|jpe?g|png|woff2?|eot|ttf|svg)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

### 3. 生产通信与跨域设置

为了确保 Studio 正常与 Admin 及预览应用通信：

1. **Admin 端配置**：在 Admin 的 `.env` 中确保 `OPENSCENE_STUDIO_PUBLIC_BASE_URL` 填写了正确的 Studio 公网域名（如 `https://studio.yourdomain.com`）。
2. **预览配置白名单**：在 Admin 的 **Preview profiles（预览配置）** 中，将生产 Studio 域名填入 `allowedOrigins`（如 `["https://studio.yourdomain.com"]`）。

---

## 部署业务渲染应用（以 React Vite 为例）

业务应用（如 `examples/react-vite`）既是终端页面的宿主，也是 Studio 内部加载的 iframe 目标。

### 1. 环境变量配置 (`.env`)

```bash
# 浏览器端运行时地址
VITE_OPENSCENE_ADMIN_URL=https://admin.yourdomain.com
VITE_OPENSCENE_APP_KEY=your-app-key

# CI/CD 构建时自动推送组件元数据清单 (可选)
OPENSCENE_ADMIN_URL=https://admin.yourdomain.com
OPENSCENE_APP_ID=app_xxxxxxxxxxxxxxxxx
OPENSCENE_APP_KEY=appkey_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. 构建与部署

```bash
# 执行构建 (Vite 插件会在 closeBundle 自动将 Manifest 发布至 Admin)
vp -C examples/react-vite build
```

打包产物输出至 `examples/react-vite/dist`，部署为静态站点或托管于 CDN 即可。

---

## 常用命令参考

```bash
# 全局依赖安装
vp install

# 运行各包单元测试
vp test packages/sdk/react
vp test examples/react-vite
vp run -r test

# 代码风格与类型检查
vp check
vp check --fix

# 全量构建
vp run build

# 文档参考
# 详细 React 与 json-render 集成说明请查看 docs/react-json-render-studio-integration.md
```

---

## 开源协议

本项目基于 [MIT 协议](LICENSE) 开源。
