# OpenScene React + json-render + Studio 集成与上线发布指南

本文档记录了在 OpenScene 体系中集成 React、`@json-render/react` 以及适配 OpenScene Studio（设计期可视化编辑器）与 Admin Runtime 的完整配置、SDK 架构、避错指南与生产上线检查清单。

---

## 1. 总体架构与分层

OpenScene 采用「JSON Render + 独立 Studio 编辑器 + 框架适配器（UI Adapter）」的分层架构：

```text
┌──────────────────────────────────────────────────────────────────┐
│                    OpenScene Studio (Editor)                     │
│  - 可视化画布 (WebIframeRenderer)                                │
│  - 属性面板 (PropertyEditor / StyleEditor / DynamicValueInput)   │
│  - 大纲树 / 插槽树 (Outline Tree)                                 │
└────────────────┬─────────────────────────────────────────────────┘
                 │ Protocol v2 Bridge (window.postMessage / MessagePort)
┌────────────────▼─────────────────────────────────────────────────┐
│              Host App Preview Iframe / Runtime                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ @openscene/javascript (Client Controller)                  │  │
│  │ - 负责与 Studio 建立双向 MessagePort 握手                  │  │
│  │ - 管理 Document Snapshot、StateStore 与 Runtime 数据获取  │  │
│  │ - 提供 Selection / Hover / Scroll / Geometry 坐标上报      │  │
│  └────────────────────────────┬───────────────────────────────┘  │
│                               │                                  │
│  ┌────────────────────────────▼───────────────────────────────┐  │
│  │ @openscene/react (SDK Adapter)                             │  │
│  │ - defineOpenSceneReactApp / defineOpenSceneReactComponent  │  │
│  │ - OpenSceneProvider / OpenSceneRenderer / useOpenSceneNode │  │
│  │ - SelectionCanvas (拖拽框选 / 单选 / 滚动同步 / 高亮包围盒)│  │
│  │ - 基于 @json-render/react 的 Renderer 与 Registry 封装     │  │
│  └────────────────────────────┬───────────────────────────────┘  │
│                               │                                  │
│  ┌────────────────────────────▼───────────────────────────────┐  │
│  │ examples/react-vite (业务组件与应用声明)                  │  │
│  │ - View / Text / Button 基础物料                            │  │
│  │ - Image / Callout / StatusCard / OpenApiProvider 扩展组件  │  │
│  │ - AppManifest (元数据清单，供 Vite 构建插件同步至 Admin)   │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. 核心包与模块说明

### 2.1 `@openscene/react` SDK 适配包 (`packages/sdk/react`)

负责连接 React 渲染体系与 OpenScene 协议层：

1. **`catalog.ts`**:
   - 提供 `defineOpenSceneReactComponent`：定义 React 组件元数据（Zod props schema、title、description、category、editor、events、render 等），并自动转换为符合协议标准的 `ComponentManifest`。
   - 提供 `defineOpenSceneReactAction`：定义运行时动作处理器（例如 `setState`）。
   - 提供 `defineOpenSceneReactApp`：组装 catalog、registry、manifest 和 action handlers。
   - 内置基础组件：`baseReactComponents`（`View`、`Text`、`Button`）。

2. **`provider.tsx`**:
   - `OpenSceneProvider`：订阅 `OpenSceneClient` 状态更新，同步 `runtimeStore` 与动作执行器。
   - `OpenSceneRenderer`：准备规整化 JSON Spec（`prepareSpec`），注入节点 ID（`__opensceneNodeId`），使用 `@json-render/react` 的 `<Renderer />` 并配合 `<SelectionCanvas>` 与错误边界进行安全渲染。
   - `createIdentityRegistry`：自动注入 `data-node-id`，处理动态表达式解析（`evaluateDynamicValue`）与可见性判断（`visible`）。

3. **`node.tsx`**:
   - `useOpenSceneNode`：获取当前节点的 `nodeId` 和 `nodeAttrs`（用于挂载 `data-node-id`）。
   - `View` / `Text` / `Button`：基础 React 节点实现，支持动态数据求值与事件派发（如 `press`）。

4. **`selection.tsx`**:
   - `SelectionCanvas`：实现 Studio 选中态与悬浮态的几何坐标计算（`rectForNode`）、画布多选框选（Marquee Drag）、滚轮/尺寸监听（`reportScroll`）以及对 Studio 画布遮罩层的绝对位置同步。

5. **`server.ts`**:
   - 提供 Node/SSR 环境安全的轻量导出（用于 Vite 构建期生成 manifest 时无 DOM 环境执行）。

---

## 3. `examples/react-vite` 工程配置详解

### 3.1 `package.json`

引入 React 19、`@json-render/react`、`@openscene/*` 工作区依赖与 Zod：

```json
{
  "name": "react-vite",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vp dev",
    "build": "vp build",
    "check": "vp check",
    "test": "vp test",
    "lint": "vp lint",
    "preview": "vp preview"
  },
  "dependencies": {
    "@json-render/core": "^0.20.0",
    "@json-render/react": "^0.20.0",
    "@openscene/constants": "workspace:*",
    "@openscene/javascript": "workspace:*",
    "@openscene/protocol": "workspace:*",
    "@openscene/react": "workspace:*",
    "@openscene/schema": "workspace:*",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "@vitejs/plugin-react": "^6.1.0",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vite-plus": "catalog:"
  }
}
```

### 3.2 `vite.config.ts`

配置 `openSceneManifestPlugin`，在构建与开发期自动提取组件 Manifest：

```ts
import { openSceneManifestPlugin } from "@openscene/javascript/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins, loadEnv } from "vite-plus";
import { createManifest } from "./src/openscene.tsx";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const manifest = createManifest(env.VITE_OPENSCENE_APP_KEY || "react-vite");

  return {
    plugins: lazyPlugins(() => [react(), openSceneManifestPlugin({ manifest })]),
  };
});
```

### 3.3 `src/openscene.tsx`（组件声明与 Manifest 导出）

声明所有可被 Studio 可视化编排的组件及属性 Schema（包含 `x-editor` 扩展元数据）：

```tsx
import React, { useEffect, useMemo, useState } from "react";
import { APP_TYPE_WEB } from "@openscene/constants";
import { defineAppManifest } from "@openscene/javascript";
import {
  baseReactComponents,
  defineOpenSceneReactAction,
  defineOpenSceneReactApp,
  defineOpenSceneReactComponent,
  type OpenSceneReactApp,
  useOpenSceneNode,
  View,
} from "@openscene/react";
import { z } from "zod";

// 1. 声明公共视图样式属性（支持 Studio 样式面板）
const baseViewProps = {
  class: z.string().optional(),
  className: z.string().optional(),
  style: z
    .record(z.string(), z.unknown())
    .meta({ "x-editor": { control: "style", type: "style" } })
    .optional(),
};

// 2. 自定义 Image 组件
const Image = defineOpenSceneReactComponent({
  type: "Image",
  schema: z
    .object({
      src: z.string().optional(),
      alt: z.string().optional(),
      fit: z.enum(["cover", "contain", "fill", "none", "scale-down"]).optional(),
      loading: z.enum(["eager", "lazy"]).optional(),
      ...baseViewProps,
    })
    .passthrough(),
  title: "Image",
  category: "media",
  tags: ["image", "media"],
  editor: { fields: ["src", "alt", "fit", "loading"] },
  children: false,
  render: (renderProps) => {
    const node = useOpenSceneNode();
    const props = renderProps.props as Record<string, unknown>;
    return (
      <img
        {...node.nodeAttrs}
        src={props.src as string | undefined}
        alt={(props.alt as string) || ""}
        className={props.className as string | undefined}
        style={props.style as React.CSSProperties}
      />
    );
  },
});

// 3. 组合组件 Callout（注意：命名必须是跨 Adapter 的通用语义名）
const Callout = defineOpenSceneReactComponent({
  type: "Callout",
  schema: z
    .object({
      tone: z.enum(["info", "success", "warning"]).optional(),
      ...baseViewProps,
    })
    .passthrough(),
  title: "Callout",
  category: "layout",
  render: (renderProps) => {
    const props = renderProps.props as Record<string, unknown>;
    const tone = (props.tone as string) || "info";
    return (
      <View
        props={{
          ...props,
          className: `react-vite-callout react-vite-callout-${tone}`,
        }}
        emit={renderProps.emit}
        on={renderProps.on}
      >
        {renderProps.children}
      </View>
    );
  },
});

// 4. 应用与 Manifest 工厂
export function createReactApp(appKey: string): OpenSceneReactApp {
  return defineOpenSceneReactApp({
    app: { key: appKey, type: APP_TYPE_WEB },
    components: [
      baseReactComponents.View,
      baseReactComponents.Text,
      baseReactComponents.Button,
      Image,
      Callout,
    ],
  });
}

export function createManifest(appKey: string) {
  return defineAppManifest(createReactApp(appKey).manifest);
}
```

### 3.4 `src/App.tsx` 与 `src/main.tsx`（应用入口与运行时挂载）

**`src/App.tsx`**:

```tsx
import type { OpenSceneClient } from "@openscene/javascript";
import { OpenSceneProvider, OpenSceneRenderer } from "@openscene/react";
import type { ReactApp } from "./openscene.tsx";
import "./App.css";

interface AppProps {
  client: OpenSceneClient;
  app: ReactApp;
}

function App(props: AppProps) {
  return (
    <OpenSceneProvider client={props.client} app={props.app}>
      <OpenSceneRenderer />
    </OpenSceneProvider>
  );
}

export default App;
```

**`src/main.tsx`**:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installOpenScene } from "@openscene/javascript";
import App from "./App.tsx";
import { createManifest, createReactApp } from "./openscene.tsx";

const appKey = import.meta.env.VITE_OPENSCENE_APP_KEY || "react-vite";
const reactApp = createReactApp(appKey);
const manifest = createManifest(appKey);
const pageKey = decodeURIComponent(window.location.pathname.replace(/^\/+|\/+$/g, "")) || "home";

// 1. 初始化客户端控制器（自动识别普通访问或 Studio iframe 预览）
const client = installOpenScene({
  apiBaseUrl: import.meta.env.VITE_OPENSCENE_ADMIN_URL,
  pageKey,
  manifest,
});

// 2. 挂载 React 根节点
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App client={client} app={reactApp} />
  </StrictMode>,
);
```

### 3.5 环境变量配置 (`.env.example`)

```bash
# 浏览器端运行时配置 (Vite 会打包带 VITE_ 前缀的环境变量)
VITE_OPENSCENE_ADMIN_URL=http://localhost:3000
VITE_OPENSCENE_APP_KEY=react-vite-app

# 构建期 Manifest 自动同步配置 (由 Vite 插件在打包时读取，不泄露给客户端)
# 如果本地构建无需向 Admin 同步，留空或注释即可
OPENSCENE_ADMIN_URL=http://localhost:3000
OPENSCENE_APP_ID=app_e3deffe02d474a21a73fedc31e408bed
OPENSCENE_APP_KEY=appkey_2z7TOcEf2_tk8_XbTikymI7mTT2r9VgJ2PNz87svZxQ
```

---

## 4. Studio 预览与通信协议 (Bridge Protocol v2)

当应用在 Studio 的 iframe 画布中打开时：

1. **握手流程**：
   - Host iframe 发送 `RENDERER_READY`。
   - Studio 发送 `STUDIO_CONNECT` 并转移 `MessagePort` 建立独立点对点信道。
2. **实时文档同步 (`SPEC_REPLACE`)**：
   - Studio 编辑属性或拖拽组件后，推送最新 `SceneDocument` 快照。
   - `OpenSceneRenderer` 检测到 `revision` 变更，重新渲染最新的 JSON 节点树。
3. **选区与高亮 (`SELECT_NODE` / `HOVER_NODE`)**：
   - 点击/框选节点时，`SelectionCanvas` 将元素在 iframe 视口内的精确坐标 (`left`, `top`, `width`, `height`) 上报给 Studio。
   - Studio 在外部画布绘制 selection overlay，不侵入或污染业务 DOM 结构。
4. **状态与动作 (`STATE_CHANGE` / `ACTION_TRIGGER`)**：
   - 用户交互派发的 action（例如修改状态）通过 `runtimeStore` 同步并触发 UI 响应。

---

## 5. 验证与测试命令

在项目根目录下，可使用统一工具链 `vp` 执行测试与构建：

```bash
# 安装/同步依赖
vp install

# 运行 @openscene/react 测试
vp test packages/sdk/react

# 运行 examples/react-vite 测试
vp test examples/react-vite

# 全量构建验证
vp run build

# 启动 React 示例应用本地开发服务器 (指定 5174 端口避免与 Studio 5173 冲突)
vp -C examples/react-vite dev -- --port 5174
```

---

## 6. 常见踩坑与避错指南（上线必读）

### 坑 1：组件 `type` 命名规范（避免“文档 type 必须是跨 Adapter 的稳定名称”报错）

- **原因**：OpenScene Studio 的 JSON 文档必须保持跨框架可移植性。Studio 内置了命名校验规则（`/^(N|Shadcn|React)[A-Z]/`），禁止在组件 `type` 中加入框架前缀（如 `ReactCallout`、`ShadcnButton`、`NCard`）。
- **避错方案**：统一使用跨框架通用的业务语义名，例如 `Callout`、`StatusCard`、`OpenApiProvider`、`Button`、`Image`。

### 坑 2：环境变量配置混淆导致 Manifest 推送 404

构建时 Vite 插件报错 `OpenScene manifest push failed (HTTP 404): The requested resource was not found` 的常见根因：

1. **`OPENSCENE_APP_ID` 填错**：必须填 Admin 数据库中生成的 App 主键 ID（格式为 `app_...`），不能填成 `appkey_...` 秘钥字符串。
2. **`OPENSCENE_APP_KEY` 权限不匹配**：必须是在 Admin 该应用详情页生成的构建密钥（`appkey_...`），不能填 `runtime_...` 运行时只读令牌。Admin 鉴权失败出于安全保护会统一返回 404。
3. **离线构建策略**：如果某次构建无需自动同步 Manifest 到 Admin，将 `OPENSCENE_ADMIN_URL`、`OPENSCENE_APP_ID`、`OPENSCENE_APP_KEY` 留空即可，构建将自动跳过推送。

### 坑 3：Studio 按钮点击无响应（缺少 Preview Profile）

- **原因**：Admin 进入 Studio 需要生成单次编辑会话，而会话必须绑定一个具体的 **Preview Profile（预览环境配置）**。如果当前应用未创建任何 Preview Profile，Admin 前端会静默拦截点击。
- **避错方案**：在 Admin 后台侧边栏点击 **「Preview profiles / 预览配置」**（`/preview-profiles`），为该应用新建一条预览配置（如 `Local React Preview`，地址为 `http://localhost:5174/`，允许来源为 `http://localhost:5173`），并勾选「设为默认 (isDefault)」。

---

## 7. 生产上线发布检查清单 (Production Checklist)

在将 OpenScene 部署上线或发布到生产环境前，请逐项核对：

- [ ] **1. 全量测试与类型检查通过**：
  ```bash
  vp check && vp test packages/sdk/react examples/react-vite && vp run build
  ```
- [ ] **2. 生产环境 Preview Profile 配置**：
  - 在生产 Admin 控制台中，为应用添加生产预览环境（如 `Staging Preview` 或 `Prod Preview`）。
  - 配置真实的 HTTPS 预览地址（如 `https://preview.yourdomain.com/`）。
  - 在 `allowedOrigins` 中严格填写生产 Studio 域名（如 `https://studio.yourdomain.com`），防止未经授权的页面嵌入与 iframe 劫持。
- [ ] **3. 生产环境变量与凭据隔离**：
  - 生产前端静态资源只暴露 `VITE_OPENSCENE_ADMIN_URL` 与 `VITE_OPENSCENE_APP_KEY`。
  - `OPENSCENE_APP_KEY`（构建秘钥）与管理端凭证仅配置在 CI/CD 流水线中，绝不打包入客户端 JS。
- [ ] **4. Manifest 正式发布**：
  - CI/CD 在执行 `vp build` 时注入生产 `OPENSCENE_ADMIN_URL`、`OPENSCENE_APP_ID`、`OPENSCENE_APP_KEY`，确保最新组件 Schema 自动同步至 Admin。
- [ ] **5. 静态资源与页面发布通道 (Release Channels)**：
  - 确认 Admin 中的 Storage 配置已就绪（S3 或 Database 存储）。
  - 确认生产发布通道（`production` / `staging`）生效，终端用户正常通过 `/@openscene/runtime` 消费已发布的页面文档。
