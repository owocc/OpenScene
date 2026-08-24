import type { DynamicMode, JsonValue } from "./document";

export type EditorControl =
  | "text"
  | "textarea"
  | "number"
  | "integer"
  | "select"
  | "boolean"
  | "color"
  | "unit"
  | "spacing"
  | "style"
  | "object"
  | "array"
  | "class"
  | "action"
  | "openapi";

export interface EditorOption {
  label: string;
  value: JsonValue;
}

export interface EditorMeta {
  control: string;
  placeholder?: string;
  options?: EditorOption[];
  units?: string[];
  keywords?: string[];
  minimum?: number;
  maximum?: number;
  step?: number;
  fields?: Record<string, PropMeta>;
  item?: EditorMeta;
  tokenSource?: string;
  allowAlpha?: boolean;
  responsive?: boolean;
}

export interface ActionMeta {
  title: string;
  description?: string;
  params?: Record<string, PropMeta>;
  allowedActions?: string[];
}

export interface SlotMeta {
  title: string;
  description?: string;
  multiple?: boolean;
  required?: boolean;
}

export interface PropMeta {
  title: string;
  description?: string;
  valueType: string;
  required?: boolean;
  translatable?: boolean;
  default?: JsonValue;
  editor: EditorMeta;
  dynamic?: DynamicMode[];
  runtime?: {
    prop?: string;
    toRuntime?: string;
    fromRuntime?: string;
  };
}

export interface ComponentMeta {
  type: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  runtime: {
    component: string;
    propMap?: Record<string, string>;
    eventMap?: Record<string, string>;
  };
  props: Record<string, PropMeta>;
  events?: Record<string, ActionMeta>;
  slots?: Record<string, SlotMeta>;
  capabilities?: string[];
}

export interface AdapterMeta {
  id: string;
  title: string;
  description?: string;
  components: ComponentMeta[];
}

export interface MetaIssue {
  adapterId: string;
  componentType?: string;
  path: string;
  message: string;
}

const SUPPORTED_EDITOR_CONTROLS = new Set<EditorControl>([
  "text",
  "textarea",
  "number",
  "integer",
  "select",
  "boolean",
  "color",
  "unit",
  "spacing",
  "style",
  "object",
  "array",
  "class",
  "action",
  "openapi",
]);

export function inspectAdapterMeta(adapter: AdapterMeta): MetaIssue[] {
  const issues: MetaIssue[] = [];
  const seenTypes = new Set<string>();

  if (!adapter.id.trim()) {
    issues.push({ adapterId: adapter.id, path: "id", message: "Adapter id 不能为空" });
  }

  for (const component of adapter.components) {
    const path = `components.${component.type}`;
    if (seenTypes.has(component.type)) {
      issues.push({
        adapterId: adapter.id,
        componentType: component.type,
        path,
        message: "组件 type 不能重复",
      });
    }
    seenTypes.add(component.type);

    if (!component.type.trim()) {
      issues.push({
        adapterId: adapter.id,
        componentType: component.type,
        path,
        message: "组件 type 不能为空",
      });
    }
    if (/^(N|Shadcn|React)[A-Z]/.test(component.type)) {
      issues.push({
        adapterId: adapter.id,
        componentType: component.type,
        path,
        message: "文档 type 必须是跨 Adapter 的稳定名称",
      });
    }
    if (!component.runtime.component.trim()) {
      issues.push({
        adapterId: adapter.id,
        componentType: component.type,
        path: `${path}.runtime.component`,
        message: "runtime.component 不能为空",
      });
    }

    for (const [propName, prop] of Object.entries(component.props)) {
      if (!SUPPORTED_EDITOR_CONTROLS.has(prop.editor.control as EditorControl)) {
        issues.push({
          adapterId: adapter.id,
          componentType: component.type,
          path: `${path}.props.${propName}.editor.control`,
          message: `未知编辑器控件 ${prop.editor.control}，Studio 将降级为 text`,
        });
      }
      if (
        prop.editor.control === "select" &&
        (!prop.editor.options || prop.editor.options.length === 0)
      ) {
        issues.push({
          adapterId: adapter.id,
          componentType: component.type,
          path: `${path}.props.${propName}.editor.options`,
          message: "select 控件必须声明 options",
        });
      }
      if (
        (prop.editor.control === "unit" || prop.editor.control === "spacing") &&
        !prop.editor.units?.length
      ) {
        issues.push({
          adapterId: adapter.id,
          componentType: component.type,
          path: `${path}.props.${propName}.editor.units`,
          message: `${prop.editor.control} 控件必须声明 units`,
        });
      }
    }
  }

  return issues;
}

export function defaultProps(meta: ComponentMeta): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(meta.props)
      .filter(([, prop]) => prop.default !== undefined)
      .map(([key, prop]) => [key, prop.default as JsonValue]),
  );
}
