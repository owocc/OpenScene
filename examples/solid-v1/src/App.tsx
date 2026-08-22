import { createSignal } from "solid-js";
import { JsonRenderer, type ActionHandler, type SceneDocument } from "@openscene/javascript/solid";

// 构造一个包含完整特性演示的精简 SceneDocument
const demoDocument: SceneDocument = {
  schemaVersion: "1.0.0",
  pageInfo: {
    title: "OpenScene Solid Runtime",
    description: "极简动态渲染引擎 - 零依赖、纯原生样式",
    locale: "zh",
  },
  globalConfig: {
    design: { width: 375 },
    variables: {
      "--brand-color": "#4f46e5",
    },
  },
  spec: {
    root: "page",
    state: {
      lang: "zh",
      count: 0,
      username: "OpenScene 开发者",
      showDetail: true,
      i18n: {
        zh: {
          welcome: "欢迎体验 OpenScene 动态渲染引擎",
          subtitle: "基于 Solid.js 的极简运行时，零 Tailwind 依赖，纯原生样式驱动",
          counter_label: "当前计数器",
          increment: "点击增加 (+1)",
          decrement: "点击减少 (-1)",
          reset: "重置",
          input_label: "用户名称双向绑定 ($bindState)",
          input_placeholder: "请输入你的名称...",
          toggle_detail: "切换说明卡片可见性",
          detail_title: "核心特性说明",
          detail_1: "1. 原生 DOM 递归渲染树与插槽分发",
          detail_2: "2. JSON Pointer ($state) 与双向绑定 ($bindState)",
          detail_3: "3. 多语言 ($t) 与字符串模板 ($template) 求值",
          detail_4: "4. 自适应设计稿样式单位 (design / px / rem / calc)",
          switch_lang: "Switch to English",
        },
        en: {
          welcome: "Welcome to OpenScene Dynamic Render Engine",
          subtitle: "A minimalist runtime powered by Solid.js without Tailwind or UI libs",
          counter_label: "Current Counter",
          increment: "Increment (+1)",
          decrement: "Decrement (-1)",
          reset: "Reset",
          input_label: "Two-way User Name Binding ($bindState)",
          input_placeholder: "Type your name...",
          toggle_detail: "Toggle Details Card Visibility",
          detail_title: "Key Features Overview",
          detail_1: "1. Pure recursive DOM tree rendering & slot dispatching",
          detail_2: "2. JSON Pointer ($state) & two-way binding ($bindState)",
          detail_3: "3. Multi-language ($t) & template ($template) evaluations",
          detail_4: "4. Adaptive design units (design / px / rem / calc)",
          switch_lang: "切换为中文",
        },
      },
    },
    elements: {
      page: {
        type: "View",
        props: {
          as: "main",
          styles: {
            display: "flex",
            flexDirection: "column",
            gap: 20,
            padding: 24,
            backgroundColor: "#ffffff",
            borderRadius: 16,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02)",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "#e2e8f0",
          },
        },
        children: ["header", "user_card", "counter_card", "detail_card", "footer"],
      },
    },
  },
};

function App() {
  const [doc] = createSignal<SceneDocument>(demoDocument);

  // 自定义动作处理器：处理计数器自增、自减、重置、语言切换与显隐切换
  const customActions: Record<string, ActionHandler> = {
    increment: (_, { setState }) => {
      setState((prev) => ({ ...prev, count: Number(prev.count ?? 0) + 1 }));
    },
    decrement: (_, { setState }) => {
      setState((prev) => ({ ...prev, count: Number(prev.count ?? 0) - 1 }));
    },
    reset: (_, { setState }) => {
      setState((prev) => ({ ...prev, count: 0 }));
    },
    toggleDetail: (_, { setState }) => {
      setState((prev) => ({ ...prev, showDetail: !prev.showDetail }));
    },
    switchLang: (_, { setState }) => {
      setState((prev) => ({ ...prev, lang: prev.lang === "zh" ? "en" : "zh" }));
    },
  };

  // 为 Spec 中的按钮注入 action 属性
  const specWithActions = (): SceneDocument => {
    const d = structuredClone(doc());
    const els = d.spec.elements;
    if (els.lang_btn?.props) {
      els.lang_btn.props.action = { name: "switchLang" };
    }
    if (els.btn_inc?.props) {
      els.btn_inc.props.action = { name: "increment" };
    }
    if (els.btn_dec?.props) {
      els.btn_dec.props.action = { name: "decrement" };
    }
    if (els.btn_reset?.props) {
      els.btn_reset.props.action = { name: "reset" };
    }
    if (els.btn_toggle?.props) {
      els.btn_toggle.props.action = { name: "toggleDetail" };
    }
    return d;
  };

  return (
    <div style={{ width: "100%" }}>
      <JsonRenderer
        document={specWithActions()}
        actions={customActions}
        onStateChange={(changes) => {
          console.log("[OpenScene State Changed]", changes);
        }}
      />
    </div>
  );
}

export default App;
