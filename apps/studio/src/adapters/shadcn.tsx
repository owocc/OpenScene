import { createElement, type CSSProperties, type ElementType, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  isRecord,
  resolveDynamicValue,
  type AppElement,
  type AppDocument,
  type JsonValue,
} from "@/core/document";
import type { AdapterMeta, ComponentMeta } from "@/core/meta";
import type { AdapterRegistry } from "@/core/registry";
import { cn } from "@/lib/utils";

export interface RuntimeRenderContext {
  id: string;
  element: AppElement;
  document: AppDocument;
  selected: boolean;
  children: ReactNode;
  slots: Record<string, ReactNode>;
  resolve: (value: JsonValue | undefined) => JsonValue | undefined;
  onSelect: (id: string) => void;
}

export type RuntimeRenderer = (context: RuntimeRenderContext) => ReactNode;

export interface RuntimeAdapter {
  meta: AdapterMeta;
  renderers: Record<string, RuntimeRenderer>;
  resolve?: (
    value: JsonValue | undefined,
    document: AppDocument,
    locale: string,
  ) => JsonValue | undefined;
}

function prop(context: RuntimeRenderContext, key: string) {
  return context.resolve(context.element.props?.[key]);
}

function asString(value: JsonValue | undefined, fallback = "") {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function asStyle(value: JsonValue | undefined): CSSProperties {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      ([, child]) => typeof child === "string" || typeof child === "number",
    ),
  ) as CSSProperties;
}

function unit(value: JsonValue | undefined): string | number | undefined {
  if (typeof value === "number" || typeof value === "string") return value;
  if (isRecord(value) && typeof value.value === "number" && typeof value.unit === "string") {
    return `${value.value}${value.unit}`;
  }
  return undefined;
}

function border(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function NodeFrame({
  context,
  children,
  className,
}: {
  context: RuntimeRenderContext;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-node-id={context.id}
      data-node-type={context.element.type}
      className={cn(
        "relative min-w-0 transition-shadow",
        context.selected && "z-10 rounded-[inherit] outline-2 outline-offset-2 outline-primary/80",
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        context.onSelect(context.id);
      }}
    >
      {children}
    </div>
  );
}

const textTags: Record<string, ElementType> = {
  p: "p",
  span: "span",
  strong: "strong",
  h1: "h1",
  h2: "h2",
  h3: "h3",
};

const textSizes: Record<string, string> = {
  sm: "text-xs",
  base: "text-sm",
  lg: "text-lg leading-8",
  xl: "text-xl",
  "2xl": "text-2xl",
  "4xl": "text-4xl leading-[1.08] tracking-[-0.04em]",
};

const textWeights: Record<string, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

const containerRenderer: RuntimeRenderer = (context) => {
  const layout = asString(prop(context, "layout"), "stack");
  const align = asString(prop(context, "align"), "stretch");
  const justify = asString(prop(context, "justify"), "flex-start");
  const style: CSSProperties = {
    display: "flex",
    flexDirection: layout === "row" ? "row" : "column",
    alignItems: align,
    justifyContent: justify,
    gap: unit(prop(context, "gap")),
    width: unit(prop(context, "width")),
    maxWidth: unit(prop(context, "maxWidth")),
    minHeight: unit(prop(context, "minHeight")),
    padding: unit(prop(context, "padding")),
    margin: unit(prop(context, "margin")),
    border: border(prop(context, "border")),
    borderRadius: unit(prop(context, "radius")),
    background: asString(prop(context, "background")) || undefined,
    color: asString(prop(context, "color")) || undefined,
    ...asStyle(prop(context, "style")),
  };

  return (
    <NodeFrame context={context} className={asString(prop(context, "className"))}>
      <div style={style}>
        {context.children}
        {Object.entries(context.slots).map(([slot, content]) => (
          <div key={slot} data-slot={slot} className="flex min-w-0 flex-1 flex-col justify-center">
            {content}
          </div>
        ))}
      </div>
    </NodeFrame>
  );
};

const textRenderer: RuntimeRenderer = (context) => {
  const Tag = textTags[asString(prop(context, "as"), "p")] ?? "p";
  const tone = asString(prop(context, "tone"), "default");
  const className = cn(
    "min-w-0",
    textSizes[asString(prop(context, "size"), "base")],
    textWeights[asString(prop(context, "weight"), "normal")],
    tone === "muted" && "text-muted-foreground",
    tone === "accent" && "text-primary/70",
    asString(prop(context, "align")) === "center" && "text-center",
    asString(prop(context, "className")),
  );

  return (
    <NodeFrame context={context}>
      {createElement(
        Tag,
        { className, style: asStyle(prop(context, "style")) },
        asString(prop(context, "content")),
      )}
    </NodeFrame>
  );
};

const buttonRenderer: RuntimeRenderer = (context) => (
  <NodeFrame context={context}>
    <Button
      variant={
        asString(prop(context, "variant"), "default") as
          | "default"
          | "outline"
          | "secondary"
          | "ghost"
          | "destructive"
          | "link"
      }
      size={
        asString(prop(context, "size"), "default") as
          | "default"
          | "xs"
          | "sm"
          | "lg"
          | "icon"
          | "icon-xs"
          | "icon-sm"
          | "icon-lg"
      }
      disabled={prop(context, "disabled") === true}
      className={asString(prop(context, "className"))}
    >
      {asString(prop(context, "label"), "Button")}
    </Button>
  </NodeFrame>
);

const inputRenderer: RuntimeRenderer = (context) => (
  <NodeFrame context={context}>
    <label className="grid gap-2 text-sm font-medium">
      <span>{asString(prop(context, "label"))}</span>
      <input
        className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        type={asString(prop(context, "type"), "text")}
        placeholder={asString(prop(context, "placeholder"))}
        value={asString(prop(context, "value"))}
        readOnly
      />
    </label>
  </NodeFrame>
);

const containerMeta: ComponentMeta = {
  type: "Container",
  title: "Container",
  description: "通用布局容器，children 是默认插槽，slots 保留命名插槽。",
  category: "Layout",
  tags: ["layout", "stack", "row"],
  runtime: { component: "container" },
  capabilities: ["children", "named-slots", "style", "responsive"],
  slots: {
    default: { title: "默认内容", multiple: true },
    left: { title: "左侧插槽", multiple: true },
    right: { title: "右侧插槽", multiple: true },
  },
  props: {
    layout: {
      title: "布局方向",
      valueType: "'stack' | 'row'",
      default: "stack",
      editor: {
        control: "select",
        options: [
          { label: "垂直", value: "stack" },
          { label: "水平", value: "row" },
        ],
      },
    },
    align: {
      title: "交叉轴对齐",
      valueType: "string",
      default: "stretch",
      editor: {
        control: "select",
        options: ["stretch", "flex-start", "center", "flex-end"].map((value) => ({
          label: value,
          value,
        })),
      },
    },
    justify: {
      title: "主轴对齐",
      valueType: "string",
      default: "flex-start",
      editor: {
        control: "select",
        options: ["flex-start", "center", "flex-end", "space-between"].map((value) => ({
          label: value,
          value,
        })),
      },
    },
    gap: {
      title: "间距",
      valueType: "string | number",
      default: "16px",
      editor: {
        control: "unit",
        units: ["px", "rem", "%", "vw", "vh"],
        keywords: ["0", "auto"],
        minimum: 0,
        responsive: true,
      },
      dynamic: ["state", "template"],
    },
    width: {
      title: "宽度",
      valueType: "string | number",
      editor: {
        control: "unit",
        units: ["px", "%", "rem", "vw", "vh"],
        keywords: ["auto", "fit-content", "max-content"],
        minimum: 0,
        responsive: true,
      },
      dynamic: ["state", "template"],
    },
    maxWidth: {
      title: "最大宽度",
      valueType: "string | number",
      editor: {
        control: "unit",
        units: ["px", "%", "rem", "vw", "vh"],
        keywords: ["none", "fit-content"],
        minimum: 0,
        responsive: true,
      },
      dynamic: ["state", "template"],
    },
    minHeight: {
      title: "最小高度",
      valueType: "string | number",
      editor: { control: "unit", units: ["px", "rem", "%", "vh"], keywords: ["auto"], minimum: 0 },
      dynamic: ["state", "template"],
    },
    padding: {
      title: "内边距",
      valueType: "string | number",
      default: "0px",
      editor: {
        control: "spacing",
        units: ["px", "rem", "%"],
        keywords: ["0", "auto"],
        minimum: 0,
        responsive: true,
      },
      dynamic: ["state", "template"],
    },
    margin: {
      title: "外边距",
      valueType: "string | number",
      editor: {
        control: "spacing",
        units: ["px", "rem", "%"],
        keywords: ["0", "auto"],
        minimum: 0,
        responsive: true,
      },
      dynamic: ["state", "template"],
    },
    background: {
      title: "背景色",
      valueType: "string",
      editor: { control: "color", tokenSource: "design.tokens.background", allowAlpha: true },
      dynamic: ["state", "template"],
    },
    color: {
      title: "文字色",
      valueType: "string",
      editor: { control: "color", tokenSource: "design.tokens.foreground", allowAlpha: true },
      dynamic: ["state", "template"],
    },
    radius: {
      title: "圆角",
      valueType: "string | number",
      editor: { control: "unit", units: ["px", "rem", "%"], keywords: ["0", "9999px"], minimum: 0 },
      dynamic: ["state", "template"],
    },
    border: {
      title: "边框",
      valueType: "string",
      editor: { control: "text", placeholder: "1px solid #e5e7eb" },
      dynamic: ["state", "template"],
    },
    className: {
      title: "className",
      valueType: "string",
      editor: { control: "class", placeholder: "bg-card text-card-foreground" },
    },
    style: {
      title: "内联样式",
      valueType: "Record<string, string | number>",
      default: {},
      editor: { control: "style", responsive: true },
    },
  },
};

const textMeta: ComponentMeta = {
  type: "Text",
  title: "Text",
  description: "语义化文本元素，支持直接文本与 i18n 词条引用。",
  category: "Content",
  tags: ["text", "typography", "i18n"],
  runtime: { component: "text" },
  props: {
    content: {
      title: "文本内容",
      valueType: "string",
      required: true,
      default: "New text",
      editor: { control: "textarea", placeholder: "输入文本或选择动态值", responsive: false },
      dynamic: ["state", "template", "i18n"],
    },
    as: {
      title: "语义标签",
      valueType: "string",
      default: "p",
      editor: {
        control: "select",
        options: ["p", "span", "strong", "h1", "h2", "h3"].map((value) => ({
          label: value,
          value,
        })),
      },
    },
    size: {
      title: "字号",
      valueType: "string",
      default: "base",
      editor: {
        control: "select",
        options: ["sm", "base", "lg", "xl", "2xl", "4xl"].map((value) => ({ label: value, value })),
      },
    },
    weight: {
      title: "字重",
      valueType: "string",
      default: "normal",
      editor: {
        control: "select",
        options: ["normal", "medium", "semibold", "bold"].map((value) => ({ label: value, value })),
      },
    },
    tone: {
      title: "色彩语义",
      valueType: "string",
      default: "default",
      editor: {
        control: "select",
        options: ["default", "muted", "accent"].map((value) => ({ label: value, value })),
      },
    },
    align: {
      title: "文本对齐",
      valueType: "string",
      default: "left",
      editor: {
        control: "select",
        options: ["left", "center", "right"].map((value) => ({ label: value, value })),
      },
    },
    className: { title: "className", valueType: "string", editor: { control: "class" } },
    style: {
      title: "内联样式",
      valueType: "Record<string, string | number>",
      default: {},
      editor: { control: "style" },
    },
  },
};

const buttonMeta: ComponentMeta = {
  type: "Button",
  title: "Button",
  description: "基于 shadcn/ui 风格的交互按钮。",
  category: "Actions",
  tags: ["button", "action"],
  runtime: { component: "button", propMap: { label: "children" } },
  capabilities: ["action"],
  events: {
    click: {
      title: "点击动作",
      description: "动作只保留声明式 JSON，不把函数写入文档。",
      allowedActions: ["setState", "navigate", "request"],
    },
  },
  props: {
    label: {
      title: "按钮文本",
      valueType: "string",
      default: "Button",
      editor: { control: "text", placeholder: "按钮文本" },
      dynamic: ["state", "template", "i18n"],
    },
    variant: {
      title: "样式变体",
      valueType: "string",
      default: "default",
      editor: {
        control: "select",
        options: ["default", "outline", "secondary", "ghost", "destructive", "link"].map(
          (value) => ({ label: value, value }),
        ),
      },
    },
    size: {
      title: "尺寸",
      valueType: "string",
      default: "default",
      editor: {
        control: "select",
        options: ["xs", "sm", "default", "lg"].map((value) => ({ label: value, value })),
      },
    },
    disabled: {
      title: "禁用",
      valueType: "boolean",
      default: false,
      editor: { control: "boolean" },
      dynamic: ["state", "bindState"],
    },
    className: { title: "className", valueType: "string", editor: { control: "class" } },
  },
};

const inputMeta: ComponentMeta = {
  type: "Input",
  title: "Input",
  description: "带标签的表单输入控件，value 可绑定到页面状态。",
  category: "Forms",
  tags: ["input", "form", "bindState"],
  runtime: { component: "input" },
  props: {
    label: {
      title: "标签",
      valueType: "string",
      default: "Label",
      editor: { control: "text" },
      dynamic: ["state", "template", "i18n"],
    },
    placeholder: {
      title: "占位文本",
      valueType: "string",
      default: "Enter a value",
      editor: { control: "text" },
      dynamic: ["state", "template", "i18n"],
    },
    value: {
      title: "值",
      valueType: "string",
      default: "",
      editor: { control: "text" },
      dynamic: ["state", "bindState", "template", "i18n"],
    },
    type: {
      title: "类型",
      valueType: "string",
      default: "text",
      editor: {
        control: "select",
        options: ["text", "email", "password", "number"].map((value) => ({ label: value, value })),
      },
    },
    required: {
      title: "必填",
      valueType: "boolean",
      default: false,
      editor: { control: "boolean" },
    },
  },
};

export const shadcnAdapter: RuntimeAdapter = {
  meta: {
    id: "shadcn",
    title: "shadcn/ui Adapter",
    description: "将稳定的 JSON 组件 type 翻译为 Studio 内的 shadcn 风格运行时。",
    components: [containerMeta, textMeta, buttonMeta, inputMeta],
  },
  renderers: {
    Container: containerRenderer,
    Text: textRenderer,
    Button: buttonRenderer,
    Input: inputRenderer,
  },
  resolve: resolveRuntimeValue,
};

export function registerShadcnAdapter(registry: AdapterRegistry) {
  registry.register(shadcnAdapter.meta);
  return shadcnAdapter;
}

export function resolveRuntimeValue(
  value: JsonValue | undefined,
  document: AppDocument,
  locale: string,
) {
  return resolveDynamicValue(value, document.spec.state, locale);
}
