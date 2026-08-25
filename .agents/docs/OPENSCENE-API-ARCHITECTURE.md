# OpenScene API 与多 App 架构设计

> 状态：Draft  
> 更新日期：2026-08-21  
> 适用范围：`apps/admin`、`apps/studio`、Host SDK、Runtime API 及相关共享包

## 1. 文档目的

本文定义 OpenScene 从现有 CMS 编辑器迁移后的服务边界、仓库结构、核心数据模型、多 App 隔离策略和第一版 HTTP API。

OpenScene 的目标不是 SaaS，而是一套可以固定版本、长期自部署的可视化内容编排系统。部署者可以选择何时升级；已经部署的 Studio、Admin、文档协议和 Host SDK 不依赖官方在线服务继续运行。

本文是架构与 API 的设计基线，不表示所列目标接口已经实现。实际接口以 Admin Route 使用的运行时 Schema 自动生成的 OpenAPI 文档为准。

## 2. 产品边界

OpenScene 由三个运行角色组成：

```text
OpenScene Admin
├── 管理多个 App
├── 管理页面、模板、分类、语言和素材
├── 保存草稿、版本和发布记录
├── 配置真实 App 的 Manifest 与 Preview
├── 提供 Studio Management API
├── 提供 Host Integration API
└── 提供 Runtime Delivery API

OpenScene Studio
├── 独立全屏 React SPA
├── 连接一个 OpenScene Admin Base URL
├── 一次编辑一个 Page 或 Template
├── 加载 App Manifest 并生成物料与属性面板
├── 通过 iframe 预览真实 App
└── 通过 Admin API 保存、版本化和发布

Host App
├── 持有真实组件源码和业务运行时
├── 注册组件及其 Meta
├── 提供 Preview 页面
├── 通过 Host SDK 与 Studio 通信
└── 在生产环境读取并渲染已发布 SceneDocument
```

### 2.1 OpenScene 拥有的内容

- App 接入配置与 Preview Profile。
- App Manifest 的缓存、校验结果和版本记录。
- Page、Template 及其元信息。
- SceneDocument、Draft、Version 和 Release。
- Category、Locale 与 Asset 元数据。
- S3 兼容对象存储中的素材和发布产物。
- Studio Bootstrap 与临时 Preview Session。

### 2.2 OpenScene 不拥有的内容

- 真实 App 的组件实现。
- App 的业务路由、商品、订单、活动等业务实体。
- 组件的生产构建产物和运行依赖。
- 用户组织、成员、订阅、计费等 SaaS 账号体系。
- 必须连接官方云端才能使用的运行能力。

### 2.3 核心原则

1. Studio 永远不加载组件商城中的远程组件代码。
2. 组件实现必须存在于 Host App 的代码库中。
3. Studio 只理解 Manifest、SceneDocument 和 Preview Protocol。
4. 页面结构修改必须经过 Document API；临时预览状态不得写入 SceneDocument。
5. Admin 是资源和版本的唯一事实来源。
6. 一个 Studio 部署只连接一个 Admin Base URL；Admin 可以管理多个 App。

## 3. 仓库结构

当前仓库已经包含 `apps/admin`、`apps/studio` 和 `packages/sdk/javascript`。目标结构建议逐步演进为：

```text
openscene/
├── apps/
│   ├── admin/                      # @openscene-ai/admin
│   │   ├── app/                    # Next.js 管理页面和 Route Handlers
│   │   ├── server/
│   │   │   ├── auth/
│   │   │   ├── db/
│   │   │   │   ├── schema/         # Drizzle SQLite Schema
│   │   │   │   └── migrations/     # Drizzle Kit SQL migrations
│   │   │   ├── openapi/             # Schema 注册表与 OpenAPI 生成器
│   │   │   ├── services/
│   │   │   ├── storage/
│   │   │   └── validation/
│   │   └── .agents/docs/
│   └── studio/                     # @openscene-ai/studio
│       └── src/
│           ├── canvas/
│           ├── content-mode/
│           ├── inspector/
│           ├── materials/
│           ├── outline/
│           ├── scenarios/
│           └── workspace/
├── packages/
│   ├── document/                   # @openscene-ai/document
│   ├── manifest/                   # @openscene-ai/manifest
│   ├── protocol/                   # @openscene-ai/protocol
│   ├── editor-core/                # @openscene-ai/editor-core
│   ├── api-client/                 # @openscene-ai/api-client，OpenAPI 生成
│   ├── host-core/                  # @openscene-ai/host-core
│   ├── host-react/                 # @openscene-ai/host-react
│   ├── host-vue/                   # @openscene-ai/host-vue
│   ├── registry-schema/            # Registry 条目格式
│   ├── cli/                        # openscene CLI
│   └── sdk/
│       └── javascript/             # 当前 SDK 雏形，后续按职责拆分或重命名
└── examples/
    ├── react-host/
    └── vue-host/
```

### 3.1 依赖方向

```text
document ─────┐
manifest ─────┼──> protocol ──> host-core ──> host-react / host-vue
              │
              └──> editor-core ──> studio

route schemas ──> openapi.json ──> Scalar API Reference
                         └───────> api-client ──> admin / studio / cli
```

- `document`、`manifest`、`protocol`、`editor-core` 必须是纯 TypeScript。
- 核心包不得依赖 React、Vue、Next.js、Kumo 或 shadcn。
- Studio 不得直接导入 Admin 的数据库或服务实现，只使用生成的 API Client。
- Host SDK 不得依赖 Studio UI。

## 4. 多 App 模型

### 4.1 隔离单位

OpenScene 是单部署实例、无内建账号体系、支持多个 App 的系统。`appId` 是所有业务资源的一级隔离键：

```text
Deployment
├── App A
│   ├── Manifest revisions
│   ├── Preview profiles
│   ├── Pages
│   ├── Templates
│   ├── Categories
│   ├── Locales
│   ├── Assets
│   └── Releases
└── App B
    └── 完全独立的同类资源
```

必须遵守以下约束：

- 所有 Page、Template、Document、Asset、Category、Locale 和 Release 都必须具有 `appId`。
- 任何按资源 ID 查询的服务都必须同时校验资源所属 `appId`，不得只凭全局 ID 越界访问。
- Page 的 `key`、Template 的 `key`、Locale 的 `code` 和 Category 的 `key` 只要求在同一 App 内唯一。
- S3 Object Key 必须包含稳定的 `appId` 前缀。
- Preview Session 必须绑定一个 App 和一个资源，不接受客户端任意覆盖 Preview URL。
- 不允许跨 App 直接引用 Template、Asset 或 Document；未来如需共享，应显式引入共享资源域，而不是放宽隔离。

### 4.2 App 配置

```ts
interface App {
  id: string;
  key: string;
  name: string;
  description: string;
  status: "active" | "disabled";
  manifest: {
    mode: "remote" | "push";
    url?: string;
    activeRevisionId?: string;
  };
  previewProfiles: PreviewProfile[];
  runtime: {
    publicBaseUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PreviewProfile {
  id: string;
  name: string;
  url: string;
  allowedOrigins: string[];
  isDefault: boolean;
  headers?: Record<string, string>; // 只允许服务端安全存储，不返回敏感值给 Studio
}
```

一个 App 可以配置多个 Preview Profile，例如 `local`、`staging`、`production`，但一个 Studio Session 只解析出一个明确的 Profile。Studio 不能通过 query 参数直接传入任意 iframe URL。

### 4.3 Manifest

Manifest 描述 App 可以被编辑的能力，不携带组件实现：

```ts
interface AppManifest {
  protocolVersion: string;
  app: {
    key: string;
    version?: string;
  };
  components: Record<string, ComponentManifest>;
  actions?: Record<string, ActionManifest>;
  dataSources?: Record<string, DataSourceManifest>;
  capabilities?: Record<string, boolean>;
}
```

组件属性不得仅根据属性名推断内容语义。可在属性 Meta 上显式声明：

```ts
interface ContentMeta {
  kind: "image" | "link" | "number" | "rich-text" | "text";
  label?: string;
  translatable?: boolean;
  required?: boolean;
  group?: string;
  searchable?: boolean;
}
```

Content Mode 只遍历显式包含 `content` Meta 的字段。

## 5. 资源与文档模型

### 5.1 Page、Template 与 Document 分离

Page 和 Template 是管理资源；Document 是可编辑内容：

```text
Page ───────┐
            ├──> Document ──> Draft
Template ───┘              ├──> Version 1
                           ├──> Version 2
                           └──> Release
```

建议模型：

```ts
interface ContentResource {
  id: string;
  appId: string;
  kind: "page" | "template";
  key: string;
  title: string;
  description: string;
  categoryId?: string;
  documentId: string;
  status: "active" | "disabled" | "draft" | "published";
  createdAt: string;
  updatedAt: string;
}

interface DocumentRecord {
  id: string;
  appId: string;
  resourceId: string;
  resourceKind: "page" | "template";
  schemaVersion: string;
  revision: number;
  draft: SceneDocument;
  createdAt: string;
  updatedAt: string;
}
```

从 Template 创建 Page 时复制 Template 当前指定版本的 SceneDocument。之后 Page 和 Template 独立演进，不保持隐式联动。

### 5.2 Draft、Version 与 Release

```text
Draft
- 可覆盖更新
- 用于 Studio 自动保存
- revision 单调递增
- 不代表正式版本

Version
- 用户显式保存产生
- 内容不可变
- 可以回溯和比较

Release
- 指向一个不可变 Version
- 表示可供 Runtime 消费的发布结果
- 可按 channel/environment 区分
```

保存必须使用乐观并发控制。Studio 提交已读取的 `revision` 或 `If-Match`，Server 在版本不匹配时返回 `409 Conflict`，不得静默覆盖别的编辑会话。

### 5.3 Preview Scenario

Preview Scenario 是 Studio 内存中的临时调试状态，不是 Document 资源：

```ts
interface PreviewScenario {
  id: string;
  name: string;
  viewport: { width: number; height: number };
  statePatch: JsonPatch[];
}
```

- 多个 Scenario 共享同一 SceneDocument。
- 每个 Scenario 使用独立 iframe、`instanceId` 和 Runtime State。
- Scenario 修改不进入 Document Draft、Version 或 Release。
- 未来如需保存调试预设，应创建独立 `ScenarioPreset` 资源，不得混入 SceneDocument。

## 6. 当前 CMS Server API 盘点

现有实现位于旧仓库 `apps/cms-server/routes`。迁移时应复用行为语义，不照搬 `/api/cms`、`/api/s3` 和 `/api/render` 的路径划分。

### 6.1 已有接口

| 领域    | 当前路径                      | 方法           | 迁移决策                                    |
| ------- | ----------------------------- | -------------- | ------------------------------------------- |
| 系统    | `/api/health`                 | GET            | 保留并版本化                                |
| 文档    | `/api/openapi.json`           | GET            | 保留，改为 Admin 的权威 OpenAPI             |
| 模板    | `/api/cms/templates`          | GET/POST       | 迁入 App 作用域 Templates API               |
| 模板    | `/api/cms/templates/{id}`     | GET/PUT/DELETE | 迁入 Templates API，PUT 改 PATCH            |
| 页面    | `/api/cms/pages`              | GET/POST       | 迁入 App 作用域 Pages API                   |
| 页面    | `/api/cms/pages/{id}`         | GET/PUT/DELETE | 迁入 Pages API，PUT 改 PATCH                |
| 页面    | `/api/cms/pages/{id}/spec`    | GET            | 被 Document API 取代                        |
| 分类    | `/api/cms/categories`         | GET/POST       | 迁入 App 作用域 Categories API              |
| 分类    | `/api/cms/categories/{id}`    | GET/PUT/DELETE | 迁入 Categories API                         |
| 语言    | `/api/cms/locales`            | GET/POST       | 迁入 App 作用域 Locales API                 |
| 语言    | `/api/cms/locales/{id}`       | PUT/DELETE     | 迁入 Locales API                            |
| 配置    | `/api/cms/config`             | GET/PUT        | 拆为 Apps 与 Preview Profiles               |
| 草稿    | `/api/render/structure/draft` | GET/POST       | 被 Document Draft API 取代                  |
| 预览    | `/api/render/preview`         | GET/POST       | 被 Studio Bootstrap 与 Preview Session 取代 |
| 预览    | `/api/render/preview/{id}`    | GET/POST       | 被 Preview Session 取代                     |
| Runtime | `/api/render/structure`       | GET            | 被 Runtime Delivery API 取代                |
| Runtime | `/api/render/structure/{id}`  | GET            | 被 Runtime Delivery API 取代                |
| Runtime | `/cms/pages/{file}`           | GET            | 作为旧兼容路由，第一版不进入新契约          |
| S3      | `/api/s3/status`              | GET            | 迁为 Storage Health                         |
| S3      | `/api/s3/publish`             | POST           | 被 Releases API 取代                        |
| S3      | `/api/s3/mapping`             | GET            | 被 Assets/Releases 查询取代                 |
| S3      | `/api/s3/query`               | GET            | 被 Assets/Runtime API 取代                  |
| Proxy   | `/api/proxy/{path}`           | ALL            | 不迁移通用代理；Manifest 使用受控接口       |

### 6.2 不应迁移的旧行为

- Web 客户端在 API 失败后自动回退 LocalStorage 并假装保存成功。
- 使用 `Record<string, any>` 作为公共接口类型。
- Page 直接内嵌可变 `spec`，Template 使用不同名称 `schema` 保存同类文档。
- 由 Studio 或浏览器提供任意 Preview URL、代理目标或 S3 凭证。
- 页面管理模型中与可视化编辑无关的 PV/UV 统计。
- 路径同时使用资源 ID、name、key 且没有明确解析规则。

## 7. 目标 HTTP API

### 7.1 通用约定

- Base Path：`/api/v1`。
- OpenAPI 由 Route 共用的运行时 Schema/注册表自动生成，不维护手写 YAML/JSON 契约。
- JSON 字段使用 `camelCase`。
- ID 为不透明字符串；URL key 与数据库 ID 分离。
- 时间统一使用 UTC ISO 8601。
- 列表接口使用 `cursor`、`limit`、`q` 和明确的过滤字段。
- 错误响应采用 `application/problem+json`。
- 修改 Draft 等并发敏感资源时使用 `revision`/`ETag` 与 `If-Match`。
- 删除成功返回 `204 No Content`，不构造假的已删除资源。
- OpenAPI `operationId` 必须稳定，用于生成 `@openscene-ai/api-client`。

标准错误示例：

```json
{
  "type": "https://openscene.dev/problems/revision-conflict",
  "title": "Document revision conflict",
  "status": 409,
  "detail": "Expected revision 12 but current revision is 13",
  "instance": "/api/v1/documents/doc_home/draft"
}
```

### 7.2 System

```text
GET /api/v1/health
GET /api/v1/storage/health
GET /openapi.json
GET /reference
```

### 7.3 Apps 与 Preview 配置

```text
GET    /api/v1/apps
POST   /api/v1/apps
GET    /api/v1/apps/{appId}
PATCH  /api/v1/apps/{appId}
DELETE /api/v1/apps/{appId}

GET    /api/v1/apps/{appId}/preview-profiles
POST   /api/v1/apps/{appId}/preview-profiles
PATCH  /api/v1/apps/{appId}/preview-profiles/{profileId}
DELETE /api/v1/apps/{appId}/preview-profiles/{profileId}

GET    /api/v1/apps/{appId}/manifest
POST   /api/v1/apps/{appId}/manifest/sync
POST   /api/v1/apps/{appId}/manifest/push
```

`manifest/sync` 只允许 Server 请求 App 配置中已保存的 Manifest URL，不接受请求体中的任意 URL，避免成为 SSRF 代理。

### 7.4 Pages

```text
GET    /api/v1/apps/{appId}/pages
POST   /api/v1/apps/{appId}/pages
GET    /api/v1/apps/{appId}/pages/{pageId}
PATCH  /api/v1/apps/{appId}/pages/{pageId}
DELETE /api/v1/apps/{appId}/pages/{pageId}
```

创建 Page 可选指定 Template：

```json
{
  "key": "home",
  "title": "首页",
  "description": "",
  "categoryId": "category_default",
  "sourceTemplate": {
    "templateId": "template_marketing",
    "versionId": "version_01"
  }
}
```

Server 在创建时复制一次 Template Version，后续不自动跟随 Template 更新。

### 7.5 Templates

```text
GET    /api/v1/apps/{appId}/templates
POST   /api/v1/apps/{appId}/templates
GET    /api/v1/apps/{appId}/templates/{templateId}
PATCH  /api/v1/apps/{appId}/templates/{templateId}
DELETE /api/v1/apps/{appId}/templates/{templateId}
```

### 7.6 Documents、Drafts、Versions 与 Releases

```text
GET    /api/v1/apps/{appId}/documents/{documentId}
GET    /api/v1/apps/{appId}/documents/{documentId}/draft
PATCH  /api/v1/apps/{appId}/documents/{documentId}/draft

GET    /api/v1/apps/{appId}/documents/{documentId}/versions
POST   /api/v1/apps/{appId}/documents/{documentId}/versions
GET    /api/v1/apps/{appId}/documents/{documentId}/versions/{versionId}

GET    /api/v1/apps/{appId}/documents/{documentId}/releases
POST   /api/v1/apps/{appId}/documents/{documentId}/releases
GET    /api/v1/apps/{appId}/releases/{releaseId}
```

Draft 保存请求：

```json
{
  "baseRevision": 12,
  "document": {
    "schemaVersion": "1.0.0",
    "pageInfo": {},
    "globalConfig": {},
    "spec": {}
  }
}
```

第一版可以保存完整文档；协议稳定后再增加 JSON Patch：

```json
{
  "baseRevision": 12,
  "patches": [
    {
      "op": "replace",
      "path": "/spec/elements/button-1/props/label",
      "value": "立即开始"
    }
  ]
}
```

### 7.7 Studio Bootstrap

```text
POST /api/v1/apps/{appId}/studio-sessions
GET  /api/v1/studio-sessions/{sessionId}/bootstrap
```

创建 Session 时指定受控资源：

```json
{
  "resourceKind": "page",
  "resourceId": "page_home",
  "previewProfileId": "preview_local",
  "returnUrl": "https://admin.example.com/pages"
}
```

Bootstrap 返回 Studio 启动所需的完整上下文：

```json
{
  "session": {
    "id": "studio_session_01",
    "expiresAt": "2026-08-21T12:00:00Z"
  },
  "app": {
    "id": "app_admin",
    "key": "admin",
    "name": "Admin"
  },
  "resource": {
    "id": "page_home",
    "kind": "page",
    "title": "首页",
    "documentId": "document_home"
  },
  "draft": {
    "revision": 12,
    "document": {}
  },
  "manifest": {},
  "preview": {
    "url": "https://app.example.com/__openscene/preview",
    "allowedOrigin": "https://app.example.com",
    "profileId": "preview_local"
  },
  "capabilities": {
    "saveDraft": true,
    "createVersion": true,
    "publish": true,
    "uploadAsset": true
  },
  "returnUrl": "https://admin.example.com/pages"
}
```

Studio 部署时只需要 Admin Base URL。App、Manifest、Preview 和资源 Endpoint 都由 Bootstrap 解析，不作为 Studio 环境变量或任意 query 参数传入。

### 7.8 Categories 与 Locales

```text
GET    /api/v1/apps/{appId}/categories
POST   /api/v1/apps/{appId}/categories
PATCH  /api/v1/apps/{appId}/categories/{categoryId}
DELETE /api/v1/apps/{appId}/categories/{categoryId}

GET    /api/v1/apps/{appId}/locales
POST   /api/v1/apps/{appId}/locales
PATCH  /api/v1/apps/{appId}/locales/{localeId}
DELETE /api/v1/apps/{appId}/locales/{localeId}
```

Category 使用显式 `scope: page | template | shared`。每个 App 必须保留一个不可删除的默认 Category。每个 App 同一时间只能有一个默认 Locale。

### 7.9 Assets 与 S3

```text
GET    /api/v1/apps/{appId}/assets
POST   /api/v1/apps/{appId}/assets/upload-intents
POST   /api/v1/apps/{appId}/assets/{assetId}/complete
GET    /api/v1/apps/{appId}/assets/{assetId}
DELETE /api/v1/apps/{appId}/assets/{assetId}
```

上传流程：

```text
Studio 请求 Upload Intent
    ↓
Admin 校验 appId、MIME、大小和存储配置
    ↓
Admin 创建 Asset(pending) 并返回短期 Presigned URL
    ↓
Studio 直接上传 S3
    ↓
Studio 调用 complete
    ↓
Admin 校验对象并将 Asset 标记为 ready
```

S3 凭证只存在于 Admin Server。SceneDocument 应优先保存 `assetId`，不要写死 S3 URL：

```json
{
  "assetId": "asset_01",
  "alt": "活动主视觉"
}
```

建议 Object Key：

```text
apps/{appId}/assets/{assetId}/{sanitizedFileName}
apps/{appId}/releases/{releaseId}/document.json
```

### 7.10 Runtime Delivery

```text
GET /api/v1/runtime/apps/{appKey}/pages/{pageKey}
GET /api/v1/runtime/apps/{appKey}/releases/{releaseId}
```

Runtime API 只返回不可变 Release 或当前已发布 Release，不返回 Draft。响应应提供 `ETag`、`Cache-Control` 和可选 CDN 地址。

## 8. Studio 与 Preview Protocol

HTTP API 负责资源与持久化；iframe Protocol 负责实时编辑交互，两者不得混用。

```text
Studio HTTP → Admin
- bootstrap
- 保存 Draft
- 创建 Version
- 发布 Release
- 上传 Asset

Studio postMessage ↔ Host Preview
- BRIDGE_READY / BRIDGE_INIT
- SPEC_REPLACE / SPEC_PATCH
- SELECT_NODE / HOVER_NODE
- NODE_CLICK / NODE_RECT_CHANGE
- SET_STATE / STATE_CHANGE
- SET_LOCALE
- CANVAS_ERROR / ACK / RESYNC_REQUIRED
```

每个 Preview iframe 必须使用独立 `instanceId`。多 Scenario 同时显示时，共享文档 revision，但 Runtime State 相互隔离。

## 9. 鉴权与安全边界

OpenScene 第一版不建立用户表。部署级鉴权支持：

```text
disabled
- 仅用于本地开发或可信网络

token
- 部署者配置高强度 Token
- Admin/Studio 通过安全同源 Cookie 或 Authorization 使用

proxy
- 由 Cloudflare Access、Authelia、Authentik、OAuth2 Proxy 等验证
- Admin 只信任明确配置的反向代理与身份请求头
```

机器访问与人访问分离：

- Management API 使用部署级鉴权。
- Host Manifest Push 使用可撤销 App Key。
- Runtime Delivery 使用只读 Runtime Key，或由部署者显式配置公开访问。
- Preview Session 使用短期、单 App、单资源、单 Origin Token。
- Token 不应长期放在 Studio URL、iframe URL 或日志中。

安全要求：

- 校验 iframe `event.origin`、`source`、`instanceId` 和协议版本。
- Manifest Sync 不允许任意 URL，防止 SSRF。
- Presigned Upload 限定对象 Key、MIME、大小和过期时间。
- Asset 删除前检查 Document/Release 引用，默认拒绝删除正在使用的素材。
- 禁止通过通用 Proxy API 转发未知目标。
- Preview Profile 中的敏感 Header 不得返回 Studio。

## 10. 数据库建议

数据库层固定使用 **Drizzle ORM + libSQL**：

```text
Drizzle ORM
    ↓
@libsql/client
    ├── file:./data/openscene.db       本地/单机自部署
    ├── :memory:                       自动化测试
    └── libsql://... / Turso           远程或托管 libSQL
```

- Schema 使用 `drizzle-orm/sqlite-core` 定义。
- 连接使用 Drizzle 的 libSQL Adapter 与 `@libsql/client`。
- Admin 数据库 Route/Service 固定使用 Next.js Node.js Runtime，不部署到 Edge Runtime。
- 开发阶段可以使用 Drizzle Kit `push` 快速试验；正式迁移必须使用 `generate` 生成 SQL 并使用 `migrate` 应用。
- 自部署默认使用本地 `file:` URL；远程 libSQL/Turso 通过 Database URL 与 Auth Token 配置。
- libSQL Auth Token 只存在于 Admin Server，不返回浏览器或 Studio。
- Drizzle 类型只允许出现在 DB/Repository 层，不进入 OpenAPI DTO 或 Studio Client。

第一版最少需要以下表：

```text
apps
preview_profiles
manifest_revisions

pages
templates
documents
document_versions
releases

categories
locales
assets

studio_sessions
app_keys
```

关键索引与约束：

```text
UNIQUE apps(key)
UNIQUE pages(app_id, key)
UNIQUE templates(app_id, key)
UNIQUE categories(app_id, scope, key)
UNIQUE locales(app_id, code)
UNIQUE documents(app_id, resource_kind, resource_id)
UNIQUE releases(app_id, id)
INDEX  assets(app_id, status, created_at)
INDEX  document_versions(document_id, created_at)
```

所有服务查询都应把 `app_id` 放入数据库条件，不依赖查询结果返回后再过滤。

## 11. 第一阶段实施范围

第一阶段目标是让 React Studio 能编辑一个由真实 Host App 渲染的页面并持久化到 Admin。

### 11.1 必须实现

1. `@openscene-ai/document`：从旧项目迁移并去除 Vue 依赖。
2. `@openscene-ai/manifest`：定义 App/Component/Content Meta。
3. `@openscene-ai/protocol`：迁移并版本化 Preview Bridge。
4. Admin 数据库基础：App、PreviewProfile、Page、Template、Document。
5. Apps CRUD 与 Manifest Sync。
6. Pages/Templates CRUD。
7. Document Draft 读取与带 revision 保存。
8. Studio Session 与 Bootstrap。
9. 运行时 Schema、自动生成的 OpenAPI、Scalar API Reference 与生成的 TypeScript Client。
10. 一个 Vue 或 React Host 示例，实现 Meta、Preview 和节点选择。
11. Studio 最小画布：单 iframe、选中节点、修改一个文本属性、保存。

### 11.2 紧随其后

- Version 与 Release。
- S3 Upload Intent 与 Asset 管理。
- Categories 与 Locales。
- Content Mode。
- 多 Preview Scenario。
- Runtime Delivery API。

### 11.3 暂缓

- 账号、组织、团队和细粒度 RBAC。
- SaaS 计费和官方云端依赖。
- 多人实时协作。
- Registry 商城前台和第三方发布审核。
- 自动更新部署实例或 Host SDK。
- PV/UV 统计与业务分析 Dashboard。

## 12. API 开发流程

1. 先定义或修改 Route 共用的运行时请求/响应 Schema，并注册稳定的 `operationId`。
2. Route Handler 必须使用同一 Schema 做运行时校验，禁止另外维护 DTO。
3. 从 Schema 注册表自动生成并校验 `/openapi.json`，不提交手写 `openapi.yaml`。
4. 使用 Scalar Next.js API Reference 在 `/reference` 渲染 `/openapi.json`。
5. 从同一份生成结果生成 `@openscene-ai/api-client`。
6. Studio、Admin UI 和 CLI 只调用生成 Client，不手写路径和响应类型。
7. 每个 operation 必须有契约测试，并验证实际响应符合生成 Schema。
8. 修改响应结构时必须明确兼容策略；破坏性变更进入新的 API 或协议大版本。
9. 自部署版本不自动升级，数据库迁移必须可重复执行并在启动前失败即停止。

## 13. 决策摘要

- 系统名称继续使用 OpenScene。
- 管理 App 名称使用 `@openscene-ai/admin`。
- 编辑器 App 名称使用 `@openscene-ai/studio`。
- Admin 同时承载管理 UI 和第一版 API Server。
- 数据库核心固定为 Drizzle ORM + libSQL，本地自部署使用 `file:`，可选连接远程 Turso/libSQL。
- 一个 Studio 只配置一个 Admin Base URL。
- 一个 Admin 实例支持多个相互隔离的 App。
- App 是 Page、Template、Document、Asset、Locale、Category 与 Release 的一级作用域。
- Studio 不持有组件实现，只加载 Manifest，并通过 iframe 预览真实 App。
- API 使用 `/api/v1`，OpenAPI 由运行时 Schema 自动生成，Scalar 提供 API Reference，Studio 使用生成 Client。
- Page/Template 与 Document 分离，Draft/Version/Release 分层。
- Preview Scenario 是临时运行状态，不写入正式 Document。
- S3 通过 Presigned Upload 使用，Studio 永远不获取 S3 凭证。
- 第一阶段先完成 API、Bridge 和单页面保存闭环，再扩展完整画布与管理能力。
