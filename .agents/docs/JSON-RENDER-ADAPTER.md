# Studio JSON Render 与 UI Adapter 规范

## 1. 目标

Studio 是 JSON Render 应用的设计期工具，而不是某个 UI 框架的页面搭建器。

应用页面、文档和新业务页面均以 `AppDocument` JSON 表达；Renderer 消费 JSON，Studio 编辑 JSON，AI 生成受约束的 JSON。具体 UI 库只通过 Adapter 接入。

```text
AppDocument JSON ──> Renderer ──> UI Adapter ──> Naive UI / shadcn / 任意 UI 库
       ▲                  │
       │                  └── Preview Bridge（预览画布）
       │
Studio Editor <── Component Meta / DataSource Meta / i18n Meta
```

## 2. 分层边界

### 2.1 Core：框架无关的 JSON 语义

Core 定义且只定义以下稳定语义：

- 文档、元素树、命名插槽、页面状态、全局配置、动作和数据源；
- 属性值与动态值的 wire format；
- 文档校验、迁移和版本兼容；
- Renderer 与 Adapter 的接口。

Core 不得导入 React、Vue、Naive UI、shadcn/ui 或任意具体业务 API。

### 2.2 Adapter：UI 库的设计期和运行期翻译层

Adapter 同时负责：

1. 将 JSON 元素 type 解析到具体 UI 组件；
2. 将通用 JSON props、事件、children 和 slots 转换为该 UI 库 API；
3. 提供 Studio 属性编辑和 AI 所需的 Component Meta；
4. 声明 UI 库支持的能力及不支持的 JSON 功能。

Adapter 不是只读 TypeScript props 的类型映射。TypeScript 类型可自动生成其基础骨架，但 Studio 的专业编辑体验必须由 Adapter Meta 显式定义。

### 2.3 Studio：设计期编辑器

Studio 不应直接了解第三方 UI 组件的 props 名或 React 实现细节。它只读取已注册 Adapter 的 Meta，以渲染：

- 物料面板；
- 大纲树与插槽树；
- 属性、样式、状态、动作和多语言编辑器；
- AI 约束上下文；
- 预览画布控制。

## 3. 文档模型

Studio 需要兼容现有 Scene 文档模型，并逐步将名称收敛为通用 `AppDocument`：

```ts
interface AppDocument {
  schemaVersion: string;
  pageInfo: {
    title: string;
    description: string;
    keywords: string[];
    locale: string;
    metadata: Record<string, unknown>;
  };
  globalConfig: {
    design: { width?: number | null };
    body: { className?: string; styles?: Record<string, unknown> };
    css?: { rules: Record<string, Record<string, string | number>> };
    i18n?: { defaultLocale?: string };
    variables: Record<string, unknown>;
  };
  spec: {
    root: string;
    elements: Record<string, AppElement>;
    state?: Record<string, unknown>;
  };
}

interface AppElement {
  type: string;
  name?: string;
  props?: Record<string, unknown>;
  on?: Record<string, unknown>;
  children?: string[];
  slots?: Record<string, string[]>;
}
```

元素以 ID 引用组成树；`children` 是默认插槽，`slots` 为命名插槽。Studio 必须保留并可编辑两种结构，不能把命名插槽扁平化为 children。

## 4. 动态值契约

任何可动态化的属性都必须接受字面量和以下对象形式；不得把运行时表达式混入普通字符串。

```ts
type DynamicValue =
  | { $state: string } // 读取状态
  | { $bindState: string } // 双向写入状态
  | { $template: string } // 模板字符串
  | { $t: string }; // i18n 词条引用
```

- 状态路径统一使用 `/path/to/value` 形式；编辑器可容忍用户输入未带 `/` 的路径，但写回时必须规范化。
- `i18n`、`lang`、`__scene` 是保留状态根键。普通状态选择器不得把 `i18n`、`__scene` 当作通用变量树暴露。
- i18n 的动态路径为 `/i18n/$lang/{key}`；直接多语言文本引用使用 `{ $t: key }`。
- Adapter Meta 必须逐项声明属性支持哪些动态值模式，Studio 不得对不支持的属性提供绑定入口。

## 5. Component Meta：Adapter 的核心交付物

每个 Adapter 必须导出可序列化的组件 Meta。TypeScript props 抽取只能用于生成 `runtime` 的初稿；最终 Meta 由人工或 AI 审核后的声明式覆写维护。

```ts
interface ComponentMeta {
  type: string; // JSON 中稳定的组件 type
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  runtime: {
    component: string; // Adapter 内的实现注册键，非 React 组件对象
    propMap?: Record<string, string>;
    eventMap?: Record<string, string>;
  };
  props: Record<string, PropMeta>;
  events?: Record<string, ActionMeta>;
  slots?: Record<string, SlotMeta>;
  capabilities?: string[];
}

interface PropMeta {
  title: string;
  description?: string;
  valueType: string;
  required?: boolean;
  default?: unknown;
  editor: EditorMeta;
  dynamic?: Array<"state" | "bindState" | "template" | "i18n">;
  runtime?: {
    prop?: string;
    toRuntime?: string;
    fromRuntime?: string;
  };
}
```

`type` 必须是稳定的跨 Adapter 名称，例如 `Button`、`Input`、`Container`；不得以 `NButton` 或 `ShadcnButton` 作为文档 JSON 的 type。一个具体库不能原样支持某个通用组件时，应在 Adapter 中声明降级或不支持，而不是污染文档格式。

## 6. 属性编辑器协议

`editor` 是 Studio 的编辑体验契约，优先级高于 TS 类型推断。至少支持以下内置编辑器：

| 编辑器               | 适用属性                 | 必要配置                         |
| -------------------- | ------------------------ | -------------------------------- |
| `text` / `textarea`  | 文本、URL、标识符        | placeholder、i18n 支持           |
| `number` / `integer` | 数值                     | min、max、step                   |
| `select`             | 枚举                     | options                          |
| `boolean`            | 开关                     | 默认值                           |
| `color`              | 色彩                     | token、透明度策略                |
| `unit`               | 宽高、间距、圆角、位置等 | units、keywords、min、响应式策略 |
| `spacing`            | padding、margin          | 四边联动、units、keywords        |
| `style`              | 样式对象                 | 样式分组与子字段 Meta            |
| `object` / `array`   | 复合配置                 | 子 schema / item schema          |
| `class`              | className / class        | 可选 class/token 来源            |
| `action`             | 事件                     | 参数 schema、可执行动作范围      |

例如 `width?: string | number` 绝不能只生成一个 text 控件，而应被 Adapter 覆写为：

```ts
width: {
  title: '宽度',
  valueType: 'string | number',
  editor: {
    control: 'unit',
    units: ['px', '%', 'rem', 'vw', 'vh'],
    keywords: ['auto', 'min-content', 'max-content', 'fit-content'],
    minimum: 0,
  },
  dynamic: ['state', 'template'],
}
```

Studio 应复用一套注册式属性编辑器表：通过 `editor.control` 选择输入控件，而不是在页面代码中按组件 type 写 if/else。未知控制类型必须降级为只读或 text，并报告 Meta 问题。

## 7. 样式与设计期专用 Meta

通用样式不应依赖某个 UI 库的 props。Adapter 可将其映射到 style prop、class、CSS variable 或库的 token API。

Studio 首批样式分组：

- 尺寸：width、height、min/max width/height；
- 间距与盒模型：margin、padding、border、border-radius；
- 背景与色彩：background、background-image、color；
- 排版：font-size、weight、line-height、letter-spacing、text-align；
- 布局：display、position、四边偏移、flex/grid、gap、对齐；
- 响应式覆盖：断点下的同一属性覆盖值。

`unit` 值可在运行时保留为数值或 `{ value, unit }`，但 Adapter 必须声明其序列化与反序列化策略；不得让不同组件自行解释同一单位格式。

## 8. 多语言插件

多语言是 Document 的通用能力，不属于某个组件。

- 词典存放于 `spec.state.i18n[locale][key]`；当前语言放在 `spec.state.lang`；页面默认语言放在 `globalConfig.i18n.defaultLocale`。
- Studio 提供词条创建、翻译编辑、搜索、重命名、删除和引用计数。
- 重命名必须迁移每个 locale 的词典并替换整个 Document 中 `{ $t: oldKey }` 引用。
- 删除前必须显示引用数；确认删除后同步移除每种语言词典的 key。
- 任何普通状态路径选择器都要排除 `i18n` 字典；i18n 由独立选择器输出 `{ $t: key }` 或 `/i18n/$lang/{key}`。

## 9. OpenAPI 数据源插件

OpenAPI 插件将 OpenAPI 文档编译为 Studio 可编辑的 `DataSourceMeta`，而不是把生成 SDK 直接写入页面 JSON。

每个 operation Meta 至少包含：

- operationId、method、path、tags、summary；
- path/query/header/body 参数 schema 与必填性；
- 成功响应的 JSON Schema、字段路径树及分页语义；
- 可用于数据绑定的输出路径；
- 安全方案与运行时权限要求。

页面 JSON 只保存稳定的 datasource 引用、参数绑定和结果写入路径。Studio 使用 Meta 编辑输入和输出绑定；Renderer 通过应用注入的 datasource executor 执行请求。不得在文档中保存 Token、Cookie 或其他凭据。

## 10. Preview Bridge

Preview Bridge 是 Studio 与独立 Renderer Canvas 的通信基础设施，和 React 或 UI Adapter 无关。

- 连接建立仅使用 `window.postMessage`；握手成功后业务消息只走 `MessageChannel` 的专属 `MessagePort`。
- 协议应保留 `protocol`、`version`、`instanceId`、`type`、`payload` 信封；接收方校验来源 window、精确 origin、版本和资源 identity。
- Canvas 先发送 `BRIDGE_READY`（identity、capabilities）；Studio 回 `BRIDGE_INIT`（Document、locale、revision、interaction mode、permissions）并转移 port。
- 后续至少支持 `SPEC_REPLACE`、`SELECT_NODE`、`HOVER_NODE`、`SET_LOCALE`、`SET_STATE`，以及 `ACK`、`NODE_CLICK`、`STATE_CHANGE`、`CANVAS_ERROR`、`RESYNC_REQUIRED`。
- `SPEC_REPLACE` 必须是完整可 structured-clone 的快照，revision 单调递增；不能传 React/Vue proxy、函数或凭据。
- 预览状态可回传，但不得反向写入尚未保存的 Document。

## 11. AI Adapter 生成流程

AI 可以生成 Adapter，但不能绕过契约直接向 AppDocument 写第三方组件 API。

1. 读取 UI 库 TypeScript 声明、源码和文档；
2. 编译出候选 props、字面量枚举、事件、插槽和默认值；
3. 生成 Component Meta 初稿；
4. 用编辑器控制类型补齐尺寸、间距、颜色、样式、响应式、动态绑定和动作语义；
5. 生成 runtime 映射及正反向转换；
6. 运行 Meta schema 校验、Renderer 组件测试、Studio 属性编辑测试和真实预览测试；
7. 输出能力矩阵与人工待确认项。

AI 生成业务页面时必须只使用已注册 Meta 中允许的组件、props、slots、动态绑定和动作；生成结果必须先通过 Document schema 校验，再进入预览。

## 12. 实施优先级

1. 固化 `AppDocument`、动态值和 Document validator；
2. 定义 Component Meta / Editor Meta / Adapter registry；
3. 将 Studio 现有 shadcn/ui 作为首个 Adapter 的渲染目标；
4. 迁移现有属性编辑器：单位、颜色、枚举、对象、数组、样式、class、状态绑定、翻译和动作；
5. 接入 Preview Bridge 与节点选择；
6. 接入 i18n 插件；
7. 接入 OpenAPI 数据源插件；
8. 最后接入 AI 生成与 Adapter 编译辅助。

## 13. 不变量

- Document JSON 不依赖具体 UI 库、框架或业务 SDK。
- Meta 是唯一的设计期组件契约；TS 类型只是它的输入之一。
- 编辑器新增控件时，应扩展 `EditorMeta` 和 renderer registry，不得向每个组件散落专用逻辑。
- 未保存的编辑态只在 Studio 内存与预览通道中流转；保存操作才可调用持久化 API。
- Adapter 不得将认证信息、运行时闭包或不可 structured-clone 的值写进 Document。
