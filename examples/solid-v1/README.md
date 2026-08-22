# OpenScene Minimal Solid Runtime (`examples/solid-v1`)

基于 **Solid.js** 的极简动态 JSON 渲染运行时，**零 Tailwind 依赖**、**零外部 UI 组件库**、**零庞杂依赖**，完全采用原生 DOM 与现代 CSS 驱动。

---

## 目录结构

```text
src/
├── runtime/
│   ├── types.ts          # 核心契约与类型定义 (Spec, Element, SceneDocument, Style, Binding)
│   ├── evaluate.ts       # 表达式与动态绑定求值 ($state, $bindState, $t, $page, $template)
│   ├── styles.ts         # 样式转换器 (commonStyleToCss, toCssValue, applyBodyConfig, design 单位)
│   ├── context.tsx       # 响应式状态与 Action 动作上下文 (RuntimeProvider, useRuntime)
│   ├── renderer.tsx      # 核心递归渲染器 (JsonRenderer, ElementRenderer, normalizeSlots)
│   ├── components/       # 精简基础原子组件
│   │   ├── utils.ts      # 组件通用属性/插槽辅助
│   │   ├── View.tsx      # 布局容器 (支持 as="div|section|main|header...")
│   │   ├── Text.tsx      # 文本与标题 (支持 as="h1|h2|p|span..."，支持 content/children)
│   │   ├── Image.tsx     # 图片展示 (src, alt, fit, width, height)
│   │   ├── Button.tsx    # 按钮 (onClick, action, text/children)
│   │   ├── Input.tsx     # 输入框 (支持 $bindState 双向数据绑定, placeholder, type)
│   │   └── registry.ts   # 组件注册表 (defaultRegistry)
│   └── index.ts          # 统一导出入口
├── App.tsx               # 动态渲染引擎完整特性演示 (计数器、双向绑定、多语言、卡片显隐)
├── index.tsx             # 应用挂载入口
└── index.css             # 纯原生全局重置样式
```

---

## 核心特性

1. **递归 DOM 渲染树**：根据 `spec.root` 与 `spec.elements` 自动递归构建 Solid 响应式组件树，支持命名插槽（`slots` / `__slotMap`）。
2. **多模式动态求值**：
   - `$state`: JSON Pointer 状态读取（如 `{"$state": "/user/name"}`）
   - `$bindState`: 状态双向绑定（如 Input 实时输入回写）
   - `$t`: 多语言翻译（结合 `state.lang` 与 `state.i18n`）
   - `$template`: 字符串模板插值（如 `{"$template": "你好，${/username}！"}`）
   - `$page`: 页面元信息绑定（如 `{"$page": "title"}` 映射至 `/__scene/pageInfo/title`）
3. **响应式动作分发**：支持内置 `setState` 及自定义 Action 处理器（如计数器增减、重置、语言切换等）。
4. **自适应样式引擎**：
   - `styles` 结构化样式自动转换为 CSS 属性。
   - 自适应 `design` 设计稿宽度换算（`calc(N / var(--scene-design-width) * 100vw)`）。
   - 自动展开 `marginX/Y` 与 `paddingX/Y`。
5. **极简轻量**：仅依赖 `solid-js`，生产构建打包体积仅 ~39KB。

---

## 本地开发与构建

```bash
# 启动开发服务
vp dev

# 编译构建
vp build
```
