# OpenScene

English | [简体中文](./README-ZH.md)

OpenScene is a modern, self-hostable visual content orchestration and page-building system. Built upon the **JSON Render + Independent Studio Editor + Framework UI Adapter** architecture, OpenScene enables seamless integration of business UI components across frameworks (React / Solid / Vue) with low-code visual editing and real-time canvas preview.

---

## Repository Structure

```text
openscene/
├── apps/
│   ├── admin/       # @openscene-ai/admin: Next.js management service (Multi-app, Releases, Assets, Studio Sessions)
│   ├── studio/      # @openscene-ai/studio: React SPA visual canvas editor
│   └── docs/        # @openscene-ai/docs: Documentation site (Astro / Nimbus)
├── packages/
│   ├── sdk/
│   │   ├── react/        # @openscene-ai/react: React 19 UI adapter and runtime components
│   │   ├── solid/        # @openscene-ai/solid: SolidJS UI adapter
│   │   └── javascript/   # @openscene-ai/javascript: Framework-neutral runtime client and Vite manifest plugin
│   ├── protocol/         # @openscene-ai/protocol: Document schema, protocol v2 bridge definitions
│   ├── schema/           # @openscene-ai/schema: Styles, layout, OpenAPI schema contracts
│   ├── constants/        # @openscene-ai/constants: Shared constants and status enums
│   └── api-client/       # @openscene-ai/api-client: Generated TypeScript Admin REST API client
├── examples/
│   ├── react-vite/       # React 19 + Vite integration example
│   └── solid-v1/         # SolidJS + Vite integration example
└── docs/                 # Detailed architecture and integration guides
```

---

## Quick Start & Local Development

This repository uses **Vite+ (`vp`)** with **Bun** as the unified package manager and toolchain.

### 1. Prerequisites

- **Node.js**: `>= 22.18.0`
- **Vite+ / Bun**: `bun >= 1.4.0`

```bash
# Install Vite+ globally if needed
npm install -g vite-plus

# Install dependencies and link workspaces
vp install

# Run full project checks and preparations
vp run ready
```

### 2. Running Local Services

Local development typically involves three concurrent services:

```bash
# Terminal 1: Start Admin backend (default: http://localhost:3000)
vp -C apps/admin dev

# Terminal 2: Start Studio canvas editor (default: http://localhost:5173)
vp -C apps/studio dev

# Terminal 3: Start Host app renderer (e.g. React Vite on port 5174)
vp -C examples/react-vite dev -- --port 5174
```

Workflow:

1. Open `http://localhost:3000` to access the Admin Console.
2. In your App's **Preview profiles** (`/preview-profiles`), add `http://localhost:5174/` as the default preview URL.
3. Open any page and click **Open in Studio** to start visual editing and real-time drag-and-drop orchestration.

---

## Deploying Admin Service (`apps/admin`)

`apps/admin` is a full-stack **Next.js** application providing the management console, RESTful management APIs, runtime document delivery, and Studio session authentication.

### 1. Environment Variables (`.env`)

Copy `apps/admin/.env.example` to `apps/admin/.env` and configure production settings:

```bash
# 1. Database connection (Local SQLite or remote LibSQL / Turso)
OPENSCENE_DATABASE_URL=file:./data/openscene.db
OPENSCENE_DATABASE_AUTH_TOKEN=

# 2. Authentication and session secrets (Must use strong random strings in production)
BETTER_AUTH_SECRET=your-random-32-character-secret-key-here
BETTER_AUTH_URL=https://admin.yourdomain.com

# 3. Public service base URLs
OPENSCENE_API_PUBLIC_BASE_URL=https://admin.yourdomain.com
OPENSCENE_STUDIO_PUBLIC_BASE_URL=https://studio.yourdomain.com

# 4. Secrets encryption key (Encrypts S3 credentials and AI provider keys)
OPENSCENE_ENCRYPTION_KEY=your-secure-encryption-key-for-secrets

# 5. Session and upload constraints
OPENSCENE_SESSION_TTL_SECONDS=1800
OPENSCENE_UI_SESSION_TTL_SECONDS=28800
OPENSCENE_MAX_UPLOAD_BYTES=52428800
OPENSCENE_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,image/gif,application/pdf
```

### 2. Database Migrations

Admin runs migrations on startup, or you can run them explicitly in your deployment pipeline:

```bash
cd apps/admin
vp run migrate
```

### 3. Build & Run

#### Option A: Node.js / PM2 Runtime

```bash
# 1. Build workspace packages and apps
vp run build

# 2. Start Next.js production server
cd apps/admin
next start -p 3000
```

PM2 configuration example (`ecosystem.config.cjs`):

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

#### Option B: Docker Container Deployment

Build from repository root:

```dockerfile
FROM oven/bun:1.4-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
COPY packages ./packages
COPY apps ./apps
COPY examples ./examples
RUN bun install --frozen-lockfile

# Build production artifacts
RUN bun run build

# Production runner image
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

## Deploying Studio Editor (`apps/studio`)

`apps/studio` is a client-side **React SPA** (Vite). It is stateless and interacts with Admin via REST APIs while driving the host iframe over the Protocol v2 Bridge.

### 1. Build Static Artifacts

```bash
# Build Studio bundle
vp -C apps/studio build
```

The output bundle is generated in `apps/studio/dist`.

### 2. Static Hosting with Nginx

Deploy `apps/studio/dist` to any static hosting provider (Nginx, Cloudflare Pages, Vercel, AWS S3 + CloudFront).

#### Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name studio.yourdomain.com;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    root /var/www/openscene-studio/dist;
    index index.html;

    # SPA routing fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets cache headers
    location ~* \.(?:ico|css|js|gif|jpe?g|png|woff2?|eot|ttf|svg)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

### 3. Production Cross-Origin & Bridge Setup

1. **Admin Config**: Set `OPENSCENE_STUDIO_PUBLIC_BASE_URL` in Admin's `.env` to your production Studio domain (e.g. `https://studio.yourdomain.com`).
2. **Preview Profile Whitelist**: In Admin Console **Preview profiles** (`/preview-profiles`), add your production Studio origin to `allowedOrigins` (e.g. `["https://studio.yourdomain.com"]`).

---

## Deploying Host Renderer App (e.g. React Vite)

The host app (such as `examples/react-vite`) renders published pages for end users and serves as the canvas iframe inside Studio.

### 1. Environment Configuration (`.env`)

```bash
# Browser runtime config
VITE_OPENSCENE_ADMIN_URL=https://admin.yourdomain.com
VITE_OPENSCENE_APP_KEY=your-app-key

# CI/CD build-time manifest publish config (optional)
OPENSCENE_ADMIN_URL=https://admin.yourdomain.com
OPENSCENE_APP_ID=app_xxxxxxxxxxxxxxxxx
OPENSCENE_APP_KEY=appkey_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Build & Deploy

```bash
# Build static bundle (Vite plugin automatically publishes manifest to Admin during closeBundle)
vp -C examples/react-vite build
```

Deploy the generated `examples/react-vite/dist` to your web server or CDN.

---

## Useful Commands Reference

```bash
# Install workspace dependencies
vp install

# Run test suites
vp test packages/sdk/react
vp test examples/react-vite
vp run -r test

# Code quality and type checks
vp check
vp check --fix

# Build all packages and apps
vp run build

# Integration guide
# See docs/react-json-render-studio-integration.md for detailed React + json-render guide
```

---

## License

This project is licensed under the [MIT License](LICENSE).
