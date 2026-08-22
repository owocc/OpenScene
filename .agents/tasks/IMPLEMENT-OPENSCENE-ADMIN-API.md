# 任务：实现 OpenScene Admin 完整服务 API

> 状态：待实施  
> 优先级：P0  
> 目标应用：`apps/admin`  
> 架构基线：`/.agents/docs/OPENSCENE-API-ARCHITECTURE.md`

## 1. 任务目标

在 `apps/admin` 中完成 OpenScene 第一版完整服务 API，使 Admin 成为多 App 配置、页面、模板、SceneDocument、版本、发布、素材和 Studio Session 的唯一事实来源。

完成后应满足：

```text
Admin 可以管理多个相互隔离的 App
    ↓
每个 App 可以配置 Manifest 和多个 Preview Profile
    ↓
每个 App 可以管理 Page、Template、Category、Locale 和 Asset
    ↓
Page / Template 拥有可版本化的 SceneDocument
    ↓
Studio 可以通过 Session Bootstrap 加载并保存 Draft
    ↓
Admin 可以创建 Version 和 Release
    ↓
Host Runtime 可以读取已发布且不可变的 SceneDocument
```

本任务只完成 `apps/admin` 内的服务端、自动生成 OpenAPI、Scalar API Reference 和服务端自动化测试。Admin 管理页面、Studio、Host SDK、共享包、CLI 和生成客户端均不在本任务范围内。

## 2. 开始前必须读取

实施前完整读取并遵循：

1. 仓库根目录 `AGENTS.md`。
2. `apps/admin/AGENTS.md`。
3. `/.agents/docs/OPENSCENE-API-ARCHITECTURE.md`。
4. `apps/admin/node_modules/next/dist/docs/` 中与当前 Next.js 版本有关的 Route Handlers、Server Components、缓存和部署文档。
5. 当前 `package.json`、Vite+ 配置和已有 workspace 结构。

不得根据旧版 Next.js 经验猜测当前 API。实现 Next.js 代码前必须以仓库内置文档为准。

## 3. 范围

### 3.1 必须实现

- 基于运行时 Schema 自动生成 OpenAPI 的工作流。
- 使用 Scalar Next.js 集成自动提供交互式 API Reference。
- 统一错误响应、分页、校验和请求上下文。
- 部署级鉴权：`disabled`、`token`、`proxy`。
- Drizzle ORM + libSQL 持久化，以及可重复执行的 Drizzle Kit 数据库迁移。
- 多 App CRUD 和严格资源隔离。
- Preview Profile CRUD。
- Manifest Push、受控 Remote Sync、版本缓存和校验。
- Page、Template、Category、Locale CRUD。
- SceneDocument Draft、乐观并发、Version 和 Release。
- Studio Session 创建和 Bootstrap。
- S3 兼容对象存储、Asset 元数据和 Presigned Upload。
- Runtime Delivery 只读接口与缓存头。
- 单元测试、集成测试、契约测试和多 App 越权测试。
- 开发环境初始化/Seed 能力。

### 3.2 不在本任务范围

- Admin 管理 UI。
- Studio React UI、画布、属性面板和 Content Mode。
- iframe Preview Protocol 的 Host 端实现。
- TypeScript API Client 的生成与 `packages/api-client`。
- `packages/document`、`packages/manifest`、`packages/protocol` 等共享包的创建或修改。
- 当前 `packages/sdk/javascript` 的修改、拆分或重命名。
- 组件 Registry 商城和 CLI 安装流程。
- 用户、组织、团队、邀请、RBAC、订阅和计费。
- 多人实时协作。
- PV/UV 或业务分析。
- 旧 `/api/cms/*`、`/api/s3/*`、`/api/render/*` 路由兼容层。
- PostgreSQL、多区域部署和云厂商专用基础设施。

## 4. 强制架构决策

### 4.1 API 与代码组织

- API Base Path 使用 `/api/v1`。
- API 唯一契约源是 Route Handler 共用的运行时 Schema/Operation 注册表，不维护手写 OpenAPI YAML 或 JSON。
- Route Handler 必须使用注册到 OpenAPI 的同一 Schema 校验输入和输出，不得手写另一套公共类型。
- 数据库、S3、鉴权和业务规则必须位于服务层，不得直接堆在 Route Handler 中。
- Route Handler 只负责解析请求、鉴权、调用服务和转换 HTTP 响应。

建议目录：

```text
apps/admin/
├── app/
│   └── api/
│       └── v1/
├── server/
│   ├── auth/
│   ├── config/
│   ├── db/
│   │   ├── migrations/
│   │   ├── repositories/
│   │   └── schema/
│   ├── errors/
│   ├── openapi/
│   │   ├── document.ts            # 从注册表生成 OpenAPI Document
│   │   ├── operations/            # operationId 与请求/响应 Schema
│   │   └── registry.ts
│   ├── services/
│   ├── storage/
│   └── validation/
└── tests/
    ├── contract/
    ├── integration/
    └── unit/
```

实际目录可按当前 Next.js 约束调整，但依赖方向必须保持清晰。

### 4.2 修改边界

- 业务代码、Schema、Route Handler、迁移和测试只允许新增或修改 `apps/admin/**`。
- 安装 `apps/admin` 必需依赖造成的根锁文件机械更新可以接受，但不得顺带修改其他 workspace 的依赖或配置。
- 不得修改 `apps/studio/**`、`packages/**`、`examples/**` 或其他应用源码。
- 如果服务端需要 SceneDocument、Manifest 或其他 DTO，本任务先在 `apps/admin/server` 内定义并验证；后续是否抽为共享包由独立任务决定。
- 架构文档中涉及 Studio、Host SDK 和 API Client 的内容只是服务消费者背景，不构成本任务的修改授权。

### 4.3 持久化

- 数据库核心固定使用 `drizzle-orm`、Drizzle Kit 和 `@libsql/client`，不得改用 Prisma、TypeORM、Sequelize 或手写 SQLite DAO。
- Schema 使用 `drizzle-orm/sqlite-core` 定义。
- 连接使用 Drizzle libSQL Adapter；本地开发/自部署支持 `file:` URL，测试支持 `:memory:`，远程支持 `libsql://`/Turso URL 与 Auth Token。
- 默认自部署配置使用本地 libSQL 文件，满足单实例固定版本长期运行；远程 Turso/libSQL 是同一套 Repository 的可选配置，不另写业务实现。
- 数据库相关 Next.js Route Handler 固定为 Node.js Runtime，不使用 Edge Runtime；本地 `file:` 数据库必须可以工作。
- Drizzle ORM/查询类型不得泄漏到 Route Handler、OpenAPI DTO 或公共包。
- 所有 Schema 变更必须有显式迁移，不得依赖生产启动时自动重建数据库。
- 使用 Drizzle Kit `generate` 生成并提交 SQL Migration，使用 `migrate` 应用。
- `drizzle-kit push` 只允许本地 Schema 试验，不得用于生产部署或替代提交迁移文件。
- 迁移由 Drizzle/libSQL 的迁移记录保证只执行一次。
- 数据库迁移失败时服务必须停止启动，不得带着部分 Schema 继续运行。
- 测试使用独立临时数据库，不得读写开发数据库。

建议结构：

```text
apps/admin/
├── drizzle.config.ts
├── drizzle/
│   ├── *.sql
│   └── meta/
└── server/db/
    ├── client.ts
    ├── migrate.ts
    ├── repositories/
    └── schema/
        └── index.ts
```

连接配置统一使用中性命名，不把实现锁死在 Turso 品牌变量中：

```text
OPENSCENE_DATABASE_URL=file:./data/openscene.db
OPENSCENE_DATABASE_AUTH_TOKEN=
```

远程示例：

```text
OPENSCENE_DATABASE_URL=libsql://database-name.turso.io
OPENSCENE_DATABASE_AUTH_TOKEN=<deployment-secret>
```

### 4.4 多 App 隔离

`appId` 是一级隔离键：

- Page、Template、Document、Version、Release、Category、Locale、Asset、PreviewProfile 和 ManifestRevision 必须关联 `appId`。
- 任何资源查询和修改都必须把 `appId` 放进数据库条件。
- 不得只按全局资源 ID 查询后再在内存中过滤。
- 访问存在但属于其他 App 的资源统一返回 `404`，不得泄露资源存在性。
- Page/Template/Category/Locale 的业务 key 只在同一 App 内唯一。
- S3 Object Key 必须以 `apps/{appId}/` 开头。
- 不允许跨 App 引用 Template、Asset、Document 或 Release。

必须编写 App A 无法读取、修改、删除或发布 App B 资源的集成测试。

### 4.5 SceneDocument

- Page 和 Template 是管理资源，不直接把可变文档混入元信息字段。
- Page/Template 分别关联一个 Document。
- Draft 可变，Version 和 Release 不可变。
- 从 Template 创建 Page 时复制指定 Template Version；创建后不自动跟随 Template。
- 第一版 Draft 保存允许提交完整 SceneDocument。
- 公共类型不得使用 `any`；未知扩展值使用 `unknown` 并进行运行时校验。
- 保存前必须校验 SceneDocument 的 `schemaVersion` 和基础结构。

### 4.6 并发控制

- Document Draft 维护单调递增的 `revision`。
- Draft GET 返回 `ETag` 或明确的 `revision`。
- Draft PATCH 必须携带 `If-Match` 或 `baseRevision`。
- revision 不匹配时返回 `409 Conflict` 和当前 revision。
- 不允许静默覆盖更新。

### 4.7 鉴权

实现以下部署模式：

```text
disabled
- 仅允许显式配置
- 适合本地开发和可信内网

token
- 从环境变量读取高强度 Token
- 支持 Authorization: Bearer
- 对浏览器同源场景可提供安全 Cookie 交换，但不得把长期 Token 写入 URL

proxy
- 只信任显式配置的代理来源和 Header
- 未配置可信代理时不得接受伪造 Header
```

鉴权类型必须分离：

- Management：Admin UI、Studio、CLI。
- App Key：Manifest Push 等 Host 写入操作。
- Runtime Key：生产 Runtime 只读访问。
- Studio Session：短期、单 App、单资源、单 Preview Origin。

不得实现用户表或账号注册登录。

### 4.8 错误格式

使用 `application/problem+json`：

```json
{
  "type": "https://openscene.dev/problems/validation-error",
  "title": "Validation failed",
  "status": 422,
  "detail": "The request body is invalid",
  "instance": "/api/v1/apps/app_a/pages",
  "errors": [
    {
      "path": "key",
      "message": "Key already exists"
    }
  ]
}
```

至少统一处理：

- `400` 请求语法错误。
- `401` 缺少或无效凭证。
- `403` 已认证但不允许执行。
- `404` 资源不存在或不属于当前 App。
- `409` 唯一键、revision、引用或状态冲突。
- `413` 上传文件过大。
- `415` 不支持的媒体类型。
- `422` 业务校验失败。
- `500` 未处理错误，响应不得泄露堆栈或凭证。

## 5. 数据模型与迁移

至少创建以下表：

```text
apps
preview_profiles
manifest_revisions
app_keys

pages
templates
documents
document_versions
releases

categories
locales
assets

studio_sessions
schema_migrations
```

最低字段要求：

### 5.1 apps

```text
id
key
name
description
status
manifest_mode
manifest_url
active_manifest_revision_id
runtime_public_base_url
created_at
updated_at
```

### 5.2 preview_profiles

```text
id
app_id
name
url
allowed_origins_json
is_default
encrypted_headers_json (可选；未实现安全加密前禁止接受敏感 Header)
created_at
updated_at
```

### 5.3 pages / templates

```text
id
app_id
key
title
description
category_id
document_id
status
created_at
updated_at
```

### 5.4 documents

```text
id
app_id
resource_kind
resource_id
schema_version
revision
draft_json
created_at
updated_at
```

### 5.5 document_versions

```text
id
app_id
document_id
version_number
document_json
source_revision
message
created_at
```

### 5.6 releases

```text
id
app_id
document_id
version_id
channel
status
storage_key
created_at
```

### 5.7 assets

```text
id
app_id
status
file_name
mime_type
size
storage_key
checksum
width
height
created_at
updated_at
```

### 5.8 studio_sessions

```text
id
app_id
resource_kind
resource_id
preview_profile_id
return_url
expires_at
created_at
```

关键约束：

```text
UNIQUE apps(key)
UNIQUE pages(app_id, key)
UNIQUE templates(app_id, key)
UNIQUE categories(app_id, scope, key)
UNIQUE locales(app_id, code)
UNIQUE documents(app_id, resource_kind, resource_id)
UNIQUE document_versions(document_id, version_number)
INDEX preview_profiles(app_id)
INDEX assets(app_id, status, created_at)
INDEX releases(app_id, document_id, channel, created_at)
INDEX studio_sessions(app_id, expires_at)
```

外键删除策略必须显式定义。默认行为：仍被 Page、Template、Version、Release 或 Document 引用的资源拒绝删除并返回 `409`。

## 6. OpenAPI 接口清单

以下接口全部注册到运行时 OpenAPI Registry，并为每个 operation 提供稳定、唯一的 `operationId`。`/openapi.json` 必须由注册表自动生成。

### 6.1 System

```text
GET /api/v1/health
GET /api/v1/storage/health
GET /openapi.json
GET /reference
```

验收：

- Health 区分进程可用和数据库/存储依赖状态。
- `/openapi.json` 由运行时 Schema 注册表生成，不读取或复制手写 Spec。
- `/reference` 使用 Scalar 展示 `/openapi.json`。
- 健康检查不得返回密钥、连接串或内部文件路径。

### 6.2 Apps

```text
GET    /api/v1/apps
POST   /api/v1/apps
GET    /api/v1/apps/{appId}
PATCH  /api/v1/apps/{appId}
DELETE /api/v1/apps/{appId}
```

验收：

- `key` 全部署唯一且创建后默认不可变。
- disabled App 不允许创建 Studio Session 或新 Release。
- 删除仍有资源的 App 默认返回 `409`，不级联清空。

### 6.3 Preview Profiles

```text
GET    /api/v1/apps/{appId}/preview-profiles
POST   /api/v1/apps/{appId}/preview-profiles
GET    /api/v1/apps/{appId}/preview-profiles/{profileId}
PATCH  /api/v1/apps/{appId}/preview-profiles/{profileId}
DELETE /api/v1/apps/{appId}/preview-profiles/{profileId}
```

验收：

- 每个 App 最多一个默认 Profile。
- URL 必须为允许的 HTTP(S) Origin/URL。
- `allowedOrigins` 标准化、去重并禁止通配符默认开放。
- Server 保存的敏感 Header 不在响应中回显。

### 6.4 Manifest

```text
GET  /api/v1/apps/{appId}/manifest
GET  /api/v1/apps/{appId}/manifest/revisions
GET  /api/v1/apps/{appId}/manifest/revisions/{revisionId}
POST /api/v1/apps/{appId}/manifest/sync
POST /api/v1/apps/{appId}/manifest/push
```

验收：

- Remote Sync 只能访问 App 已保存的 `manifestUrl`。
- 禁止请求体传入任意目标 URL。
- 校验协议版本、App Identity、组件 key 唯一性和属性 Meta。
- 内容字段只由显式 `content` Meta 决定，不按 `text`、`label` 等属性名猜测。
- Manifest 内容相同不得创建无意义的新 Revision。
- Push 使用 App Key，不能复用 Management Token。

### 6.5 Pages

```text
GET    /api/v1/apps/{appId}/pages
POST   /api/v1/apps/{appId}/pages
GET    /api/v1/apps/{appId}/pages/{pageId}
PATCH  /api/v1/apps/{appId}/pages/{pageId}
DELETE /api/v1/apps/{appId}/pages/{pageId}
```

验收：

- 创建 Page 同时原子创建 Document。
- 可从同一 App 的指定 Template Version 初始化。
- 不允许引用其他 App 的 Template/Version。
- Page 创建后与源 Template 独立。
- 列表支持 `cursor`、`limit`、`q`、`status`、`categoryId`。

### 6.6 Templates

```text
GET    /api/v1/apps/{appId}/templates
POST   /api/v1/apps/{appId}/templates
GET    /api/v1/apps/{appId}/templates/{templateId}
PATCH  /api/v1/apps/{appId}/templates/{templateId}
DELETE /api/v1/apps/{appId}/templates/{templateId}
```

验收：

- 创建 Template 同时原子创建 Document。
- Template 本身不直接发布为 Runtime Page。
- 已被 Page 创建记录引用不阻止后续 Template 修改，因为 Page 使用快照。
- 列表过滤规则与 Pages 一致。

### 6.7 Documents 与 Draft

```text
GET   /api/v1/apps/{appId}/documents/{documentId}
GET   /api/v1/apps/{appId}/documents/{documentId}/draft
PATCH /api/v1/apps/{appId}/documents/{documentId}/draft
```

验收：

- GET 返回当前 revision 和 ETag。
- PATCH 校验 SceneDocument 并执行乐观并发。
- 成功保存 revision 只增加一次。
- revision 冲突返回 `409`，响应包含当前 revision，但不泄露其他 App 数据。
- 保存失败不得留下部分文档或错误 revision。

### 6.8 Versions

```text
GET  /api/v1/apps/{appId}/documents/{documentId}/versions
POST /api/v1/apps/{appId}/documents/{documentId}/versions
GET  /api/v1/apps/{appId}/documents/{documentId}/versions/{versionId}
```

验收：

- Version 是 Draft 某 revision 的不可变快照。
- 创建 Version 必须记录 `sourceRevision`。
- 已创建 Version 不允许 PATCH/DELETE。
- 相同 Document 的 version number 单调递增。

### 6.9 Releases

```text
GET  /api/v1/apps/{appId}/documents/{documentId}/releases
POST /api/v1/apps/{appId}/documents/{documentId}/releases
GET  /api/v1/apps/{appId}/releases/{releaseId}
```

验收：

- Release 必须引用同一 App、同一 Document 的 Version。
- Release 不直接引用可变 Draft。
- 发布到 S3 时先写不可变对象，再提交数据库状态。
- 失败发布可重试，但不得产生指向不存在对象的 active Release。
- channel 至少支持 `production`，并允许未来扩展。

### 6.10 Categories

```text
GET    /api/v1/apps/{appId}/categories
POST   /api/v1/apps/{appId}/categories
GET    /api/v1/apps/{appId}/categories/{categoryId}
PATCH  /api/v1/apps/{appId}/categories/{categoryId}
DELETE /api/v1/apps/{appId}/categories/{categoryId}
```

验收：

- `scope` 为 `page | template | shared`。
- 每个 App 自动创建默认 Category。
- 默认 Category 不可删除。
- 被资源引用的 Category 默认不可删除。

### 6.11 Locales

```text
GET    /api/v1/apps/{appId}/locales
POST   /api/v1/apps/{appId}/locales
GET    /api/v1/apps/{appId}/locales/{localeId}
PATCH  /api/v1/apps/{appId}/locales/{localeId}
DELETE /api/v1/apps/{appId}/locales/{localeId}
```

验收：

- `code` 在 App 内唯一并标准化。
- 每个 App 同时只有一个默认 Locale。
- 切换默认 Locale 必须在事务中完成。
- 默认 Locale 不可直接删除。

### 6.12 Assets 与 S3

```text
GET    /api/v1/apps/{appId}/assets
POST   /api/v1/apps/{appId}/assets/upload-intents
GET    /api/v1/apps/{appId}/assets/{assetId}
POST   /api/v1/apps/{appId}/assets/{assetId}/complete
DELETE /api/v1/apps/{appId}/assets/{assetId}
```

验收：

- 支持 AWS S3 和 S3-compatible Endpoint。
- Admin 从环境配置读取凭证，API 永不返回凭证。
- Upload Intent 限定 `appId`、Object Key、MIME、大小和有效期。
- `complete` 必须通过 HeadObject 校验对象存在、大小和 MIME。
- SceneDocument 使用 `assetId` 引用素材。
- 被 Document/Version/Release 引用的 Asset 返回 `409`，不得删除。
- S3 Object Key 使用 `apps/{appId}/assets/...`。

### 6.13 Studio Sessions

```text
POST /api/v1/apps/{appId}/studio-sessions
GET  /api/v1/studio-sessions/{sessionId}/bootstrap
```

验收：

- Session 绑定 App、Page/Template、Preview Profile 和过期时间。
- 资源和 Profile 必须属于同一 App。
- Bootstrap 返回 Resource、Draft、Manifest、Preview 和 Capabilities。
- Bootstrap 不返回 Preview Profile 的敏感 Header。
- Studio 不能通过 query/body 覆盖任意 Preview URL。
- 过期 Session 返回 `401` 或明确的 `410`，在 OpenAPI 中固定一种行为。
- Session ID 必须不可预测；如作为 URL 定位符，不能同时作为长期 Management 凭证。

### 6.14 Runtime Delivery

```text
GET /api/v1/runtime/apps/{appKey}/pages/{pageKey}
GET /api/v1/runtime/apps/{appKey}/releases/{releaseId}
```

验收：

- 只返回已发布的不可变 Version，不返回 Draft。
- disabled App 或未发布 Page 返回 `404`。
- 响应包含稳定 ETag 和适合 CDN 的 Cache-Control。
- Runtime Key 只允许读取绑定 App 的公开内容。
- 不得通过 Runtime API 枚举其他 App 或管理资源。

## 7. OpenAPI 与 Scalar API Reference

### 7.1 OpenAPI 要求

- 选择并固定一个 OpenAPI 3.x 版本。
- 选择一个支持运行时校验并能生成 OpenAPI 的 Schema/Registry 方案；请求校验、响应校验和 OpenAPI 必须来自同一套 Schema。
- 每个 operation 提供 `operationId`、tags、request/response schema 和错误响应。
- 所有 DTO 使用 components/schemas 复用。
- 明确 nullable 与 optional 的差异。
- Cursor Pagination、Problem Details、时间、ID、状态枚举统一定义。
- OpenAPI 校验必须进入 `vp check` 或独立 workspace task。
- `/openapi.json` 在构建期和运行期都由同一个生成函数产生，不得维护第二份手写契约。
- 生成结果必须确定性排序，确保相同代码产生稳定 Spec，便于漂移检查。

### 7.2 Scalar API Reference

- 集成 `@scalar/nextjs-api-reference`，通过 App Router Route Handler 提供 `/reference`。
- Scalar 配置指向同源 `/openapi.json`，不得复制一份静态 Spec。
- API Reference 默认受 Management 鉴权保护；若部署者显式开放文档，必须通过配置控制。
- 当前项目使用 Next.js 16.3.1，而 Scalar 官方 Next.js 集成页面明确标注的兼容版本为 Next.js 15。实施时必须完成 Next.js 16 构建和运行验证，不得为接入 Scalar 降级 Next.js。
- 如果使用严格 CSP，应按 Scalar 集成要求为每次请求生成 nonce，禁止为了文档页面全局放开 `script-src unsafe-inline`。
- Scalar 页面只负责展示和试调 API，不作为 OpenAPI 的生成来源。

## 8. 配置

至少支持以下配置语义，具体变量名在实现时统一并记录到 `.env.example`：

```text
Database
- OPENSCENE_DATABASE_URL（默认本地 file:，也支持 libsql:// / Turso）
- OPENSCENE_DATABASE_AUTH_TOKEN（本地 file: 可空，远程 libSQL 使用）

Auth
- mode: disabled | token | proxy
- management token
- trusted proxy/header

S3
- endpoint
- region
- bucket
- access key id
- secret access key
- force path style
- public/CDN base URL（可选）

Studio
- Studio public base URL
- Session TTL

Security
- allowed management origins
- maximum upload size
- allowed MIME types
```

要求：

- 提供 `.env.example`，只能包含示例值。
- 启动时集中校验配置，错误配置应快速失败。
- 日志和错误不得打印 Secret、Token、完整 Presigned URL 或敏感 Header。
- 文件路径使用明确的应用配置变量，不依赖当前工作目录猜测。

## 9. 实施顺序

按以下顺序推进；每一阶段完成后保持仓库可构建、可测试：

### 阶段 0：现状与工具链

- 检查分支、工作区和用户已有修改。
- 阅读 Next.js 本地文档。
- 确认 Vite+ 的 `vp` 命令和 workspace task。
- 选择并记录运行时 Schema/OpenAPI 生成方案；数据库方案固定为 Drizzle ORM + `@libsql/client` + Drizzle Kit。
- 按当前安装版本的官方 Drizzle libSQL/Turso 文档配置 `drizzle.config.ts`，不要混用其他数据库驱动教程。
- 只安装完成本任务必需的依赖。

### 阶段 1：契约骨架与服务基础

- 建立运行时 Schema、Operation Registry 和确定性的 OpenAPI Document 生成器。
- 提供自动生成的 `/openapi.json` 和 Scalar `/reference`。
- 实现 Problem Details、请求校验、鉴权中间层和统一响应。
- 建立数据库连接、迁移框架、Repository 和测试数据库工具。
- 实现 System API。

### 阶段 2：多 App 基础

- 实现 Apps、Preview Profiles、Manifest Revisions 和 App Keys。
- 完成多 App 唯一键和越权测试。
- 实现受控 Manifest Sync 与 Push。

### 阶段 3：内容资源

- 实现 Categories、Locales。
- 实现 Pages、Templates，并在创建时原子创建 Document。
- 实现从 Template Version 创建 Page。

### 阶段 4：编辑保存闭环

- 实现 Document Draft GET/PATCH。
- 实现 SceneDocument 运行时校验。
- 实现 revision/ETag 并发控制。
- 实现 Studio Session 与 Bootstrap。

到此必须能用 API 完成：创建 App → 配置 Preview → 创建 Page → 获取 Bootstrap → 保存 Draft。

### 阶段 5：版本与发布

- 实现 Version 不可变快照。
- 实现 Release 状态机。
- 实现 Runtime Delivery 与缓存头。

### 阶段 6：素材

- 实现 S3 Storage Adapter。
- 实现 Storage Health、Upload Intent、Complete、查询和删除保护。
- 验证 LocalStack/MinIO 或兼容 S3 的本地测试路径。

### 阶段 7：完整服务验证

- 完成 OpenAPI 契约覆盖检查和 Scalar Next.js 16 兼容验证。
- 使用 Admin 集成测试完成 Studio Bootstrap、Draft 保存和 Runtime Delivery 的 HTTP 调用闭环。
- 运行所有检查并审查最终 diff。

## 10. 测试要求

### 10.1 单元测试

- App/资源 key 标准化与校验。
- SceneDocument 校验。
- Manifest 校验与内容 Meta。
- Revision 冲突。
- 默认 Category/Locale 规则。
- S3 Object Key 生成和文件校验。
- 鉴权模式和凭证解析。

### 10.2 集成测试

至少覆盖：

```text
App CRUD
Preview Profile CRUD
Manifest Push 与 Remote Sync
Page / Template CRUD
从 Template Version 创建 Page
Draft 保存与冲突
Version / Release / Runtime 获取
Category / Locale 默认规则
Asset Upload Intent / Complete / 删除保护
Studio Bootstrap
部署鉴权三种模式
```

### 10.3 多 App 安全测试

至少创建 App A 和 App B，验证 App A 凭据或路径上下文不能：

- 读取或修改 App B 的 Page、Template 或 Document。
- 使用 App B 的 Template 创建 Page。
- 发布 App B 的 Version。
- 完成或删除 App B 的 Asset。
- 使用 App B 的 Preview Profile 创建 Session。
- 读取 App B 的 Manifest Revision。
- 通过 Runtime API 获取 App B 的非公开资源。

### 10.4 契约测试

- 每个 OpenAPI operation 至少有一个成功响应测试。
- 每类公共错误至少有一个响应 schema 测试。
- 实际 Route Handler 不得存在于 OpenAPI 之外。
- OpenAPI 中不得声明没有实现的 operation。
- OpenAPI 文档中的示例请求必须能调用测试 Server，并符合实际响应 Schema。

## 11. 验证命令

实施者应先检查实际脚本，再使用仓库规定的 Vite+ 工作流。最低要求：

```bash
vp install
vp check
vp test
vp run -r build
```

如果仓库为 Admin API 增加专门任务，还必须运行并记录：

```text
OpenAPI validate
Database migrate on empty database
Database migrate on existing database
Database integration tests on local file: libSQL
Database integration tests on :memory: libSQL
Optional remote libSQL/Turso smoke test when credentials are explicitly provided
Admin integration tests
S3-compatible integration tests
```

不得为了通过检查关闭 TypeScript、跳过校验、使用 `any` 或禁用失败测试。

## 12. Definition of Done

只有全部满足以下条件，任务才完成：

1. 运行时 Schema/Operation Registry 覆盖本文第 6 节全部接口，且没有手写 `openapi.yaml` 或静态 `openapi.json`。
2. OpenAPI 校验通过，`/openapi.json` 可访问并能由同一生成函数确定性重建。
3. `/reference` 使用 Scalar 正确加载 `/openapi.json`，并通过 Next.js 16 构建和运行验证。
4. 全部接口有真实持久化实现，不使用内存数组或 LocalStorage 伪装保存。
5. Drizzle/libSQL 空库可以通过提交的 Migration 完成初始化，已有库可以安全重复启动。
6. 多 App 数据在数据库查询、API 路由、S3 Key 和 Preview Session 中严格隔离。
7. Page/Template 与 Document 分离，Draft/Version/Release 语义成立。
8. Draft 保存具备 revision/ETag 并发保护。
9. Manifest Sync 不接受任意 URL，Preview Session 不接受任意 Preview URL。
10. S3 上传使用短期 Presigned URL，API 不暴露 S3 凭证。
11. Runtime API 只返回 Release，不返回 Draft。
12. 所有单元、集成、多 App 安全和契约测试通过。
13. `vp check`、`vp test` 和相关 build 通过。
14. `.env.example`、数据库迁移和本地启动说明完整。
15. 除依赖安装造成的根锁文件机械更新外，最终 diff 只包含 `apps/admin/**`，且不包含 Admin UI、Studio、共享包、SDK、CLI、无关重构或真实密钥。

## 13. 实施报告要求

完成后必须报告：

- 实现的 API 分组和未实现项；未实现项存在时不得声称任务完成。
- OpenAPI Schema Registry、自动生成端点、Scalar Reference 和数据库迁移的位置。
- Drizzle/libSQL 连接方式、Migration 和 S3 方案。
- 鉴权模式及本地配置方式。
- 执行过的全部验证命令和结果。
- 多 App 越权测试结果。
- 已知限制和后续兼容性风险。
- 工作区是否存在与任务无关的用户修改。

未经用户明确授权，不得创建 commit、push 或改写 Git 历史。
