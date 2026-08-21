export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface DynamicStateValue extends JsonObject {
  $state: string;
}

export interface DynamicBindStateValue extends JsonObject {
  $bindState: string;
}

export interface DynamicTemplateValue extends JsonObject {
  $template: string;
}

export interface DynamicI18nValue extends JsonObject {
  $t: string;
}

export type DynamicValue =
  | DynamicStateValue
  | DynamicBindStateValue
  | DynamicTemplateValue
  | DynamicI18nValue;

export type DynamicMode = "state" | "bindState" | "template" | "i18n";

export interface AppElement {
  type: string;
  name?: string;
  props?: Record<string, JsonValue>;
  on?: Record<string, JsonValue>;
  children?: string[];
  slots?: Record<string, string[]>;
}

export interface AppDocument {
  schemaVersion: string;
  pageInfo: {
    title: string;
    description: string;
    keywords: string[];
    locale: string;
    metadata: Record<string, JsonValue>;
  };
  globalConfig: {
    design: {
      width?: number | null;
    };
    body: {
      className?: string;
      styles?: Record<string, JsonValue>;
    };
    css?: {
      rules: Record<string, Record<string, string | number>>;
    };
    i18n?: {
      defaultLocale?: string;
    };
    variables: Record<string, JsonValue>;
  };
  spec: {
    root: string;
    elements: Record<string, AppElement>;
    state?: Record<string, JsonValue>;
  };
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  document?: AppDocument;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isDynamicValue(value: unknown): value is DynamicValue {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return false;
  }

  const key = keys[0];
  return (
    (key === "$state" || key === "$bindState" || key === "$template" || key === "$t") &&
    typeof value[key] === "string"
  );
}

export function dynamicMode(value: unknown): DynamicMode | undefined {
  if (!isDynamicValue(value)) {
    return undefined;
  }

  if ("$state" in value) return "state";
  if ("$bindState" in value) return "bindState";
  if ("$template" in value) return "template";
  return "i18n";
}

export function dynamicValue(mode: DynamicMode, value: string): DynamicValue {
  if (mode === "state") return { $state: normalizeStatePath(value) };
  if (mode === "bindState") return { $bindState: normalizeStatePath(value) };
  if (mode === "template") return { $template: value };
  return { $t: value.trim() };
}

export function dynamicValueText(value: unknown): string {
  if (!isDynamicValue(value)) {
    return "";
  }

  const payload = Object.values(value)[0];
  return typeof payload === "string" ? payload : "";
}

export function normalizeStatePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed === "") {
    return "/";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function isReservedStateRoot(key: string): boolean {
  return key === "i18n" || key === "lang" || key === "__scene";
}

export function getEditableStatePaths(state: Record<string, JsonValue> | undefined): string[] {
  if (!state) {
    return [];
  }

  const paths: string[] = [];
  const visit = (value: JsonValue, path: string) => {
    paths.push(path);
    if (!isRecord(value)) {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      visit(child, `${path}/${key}`);
    }
  };

  for (const [key, value] of Object.entries(state)) {
    if (!isReservedStateRoot(key)) {
      visit(value, `/${key}`);
    }
  }

  return paths;
}

export function readStatePath(
  state: Record<string, JsonValue> | undefined,
  path: string,
): JsonValue | undefined {
  if (!state) {
    return undefined;
  }

  const segments = normalizeStatePath(path).split("/").filter(Boolean);
  let current: JsonValue = state;
  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function readTranslation(
  state: Record<string, JsonValue> | undefined,
  locale: string,
  key: string,
): JsonValue | undefined {
  const dictionaries = state?.i18n;
  if (!isRecord(dictionaries)) {
    return undefined;
  }

  const dictionary = dictionaries[locale] ?? dictionaries["en-US"];
  if (!isRecord(dictionary)) {
    return undefined;
  }

  return dictionary[key];
}

export function resolveDynamicValue(
  value: JsonValue | undefined,
  state: Record<string, JsonValue> | undefined,
  locale: string,
): JsonValue | undefined {
  if (!isDynamicValue(value)) {
    return value;
  }

  if ("$state" in value || "$bindState" in value) {
    return readStatePath(state, dynamicValueText(value));
  }

  if ("$t" in value) {
    const key = dynamicValueText(value);
    return readTranslation(state, locale, key) ?? key;
  }

  return dynamicValueText(value).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, path: string) => {
    const resolved = readStatePath(state, path);
    if (resolved === undefined || resolved === null) return "";
    return typeof resolved === "object" ? JSON.stringify(resolved) : String(resolved);
  });
}

function isJsonValue(value: unknown, seen = new WeakSet<object>()): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (typeof value !== "object") {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item, seen));
  }

  return Object.values(value).every((item) => isJsonValue(item, seen));
}

function validateJsonValue(value: unknown, path: string, issues: ValidationIssue[]) {
  if (!isJsonValue(value)) {
    issues.push({ path, message: "必须是可 structured-clone 的 JSON 值" });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const dynamicKeys = Object.keys(value).filter((key) => key.startsWith("$"));
  if (dynamicKeys.length > 0 && !isDynamicValue(value)) {
    issues.push({
      path,
      message: "动态值对象只能包含一个受支持的 $state/$bindState/$template/$t 键",
    });
  }

  for (const [key, child] of Object.entries(value)) {
    validateJsonValue(child, `${path}.${key}`, issues);
  }
}

function requireRecord(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is Record<string, unknown> {
  if (!isRecord(value)) {
    issues.push({ path, message: "必须是对象" });
    return false;
  }
  return true;
}

function requireString(value: unknown, path: string, issues: ValidationIssue[]): value is string {
  if (typeof value !== "string" || value.trim() === "") {
    issues.push({ path, message: "必须是非空字符串" });
    return false;
  }
  return true;
}

function validateElement(element: unknown, path: string, issues: ValidationIssue[]) {
  if (!requireRecord(element, path, issues)) {
    return;
  }

  requireString(element.type, `${path}.type`, issues);
  if (element.name !== undefined && typeof element.name !== "string") {
    issues.push({ path: `${path}.name`, message: "必须是字符串" });
  }

  for (const key of ["props", "on"] as const) {
    if (element[key] !== undefined && !requireRecord(element[key], `${path}.${key}`, issues)) {
      continue;
    }
    if (isRecord(element[key])) {
      for (const [prop, value] of Object.entries(element[key])) {
        validateJsonValue(value, `${path}.${key}.${prop}`, issues);
      }
    }
  }

  for (const key of ["children"] as const) {
    if (element[key] === undefined) continue;
    if (!Array.isArray(element[key])) {
      issues.push({ path: `${path}.${key}`, message: "必须是元素 ID 数组" });
      continue;
    }
    element[key].forEach((child, index) => {
      if (typeof child !== "string" || child.trim() === "") {
        issues.push({ path: `${path}.${key}[${index}]`, message: "必须是非空元素 ID" });
      }
    });
  }

  if (element.slots !== undefined && !requireRecord(element.slots, `${path}.slots`, issues)) {
    return;
  }
  if (isRecord(element.slots)) {
    for (const [slot, children] of Object.entries(element.slots)) {
      if (!Array.isArray(children)) {
        issues.push({ path: `${path}.slots.${slot}`, message: "必须是元素 ID 数组" });
        continue;
      }
      children.forEach((child, index) => {
        if (typeof child !== "string" || child.trim() === "") {
          issues.push({ path: `${path}.slots.${slot}[${index}]`, message: "必须是非空元素 ID" });
        }
      });
    }
  }
}

export function validateAppDocument(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!requireRecord(value, "$", issues)) {
    return { valid: false, issues };
  }

  requireString(value.schemaVersion, "$.schemaVersion", issues);

  const pageInfo = requireRecord(value.pageInfo, "$.pageInfo", issues) ? value.pageInfo : undefined;
  if (pageInfo) {
    for (const key of ["title", "description", "locale"] as const) {
      if (typeof pageInfo[key] !== "string") {
        issues.push({ path: `$.pageInfo.${key}`, message: "必须是字符串" });
      }
    }
    if (
      !Array.isArray(pageInfo.keywords) ||
      !pageInfo.keywords.every((item) => typeof item === "string")
    ) {
      issues.push({ path: "$.pageInfo.keywords", message: "必须是字符串数组" });
    }
    if (!requireRecord(pageInfo.metadata, "$.pageInfo.metadata", issues)) {
      // The nested diagnostic is enough; no additional validation is needed here.
    }
  }

  const globalConfig = requireRecord(value.globalConfig, "$.globalConfig", issues)
    ? value.globalConfig
    : undefined;
  if (globalConfig) {
    const designValue = globalConfig.design;
    if (requireRecord(designValue, "$.globalConfig.design", issues)) {
      if (
        designValue.width !== undefined &&
        designValue.width !== null &&
        typeof designValue.width !== "number"
      ) {
        issues.push({ path: "$.globalConfig.design.width", message: "必须是数字或 null" });
      }
    }
    const bodyValue = globalConfig.body;
    if (requireRecord(bodyValue, "$.globalConfig.body", issues)) {
      if (bodyValue.className !== undefined && typeof bodyValue.className !== "string") {
        issues.push({ path: "$.globalConfig.body.className", message: "必须是字符串" });
      }
      if (bodyValue.styles !== undefined)
        validateJsonValue(bodyValue.styles, "$.globalConfig.body.styles", issues);
    }
    if (globalConfig.css !== undefined) {
      const cssValue = globalConfig.css;
      if (requireRecord(cssValue, "$.globalConfig.css", issues)) {
        if (!requireRecord(cssValue.rules, "$.globalConfig.css.rules", issues)) {
          // Nested diagnostic is enough.
        }
      }
    }
    if (
      globalConfig.i18n !== undefined &&
      !requireRecord(globalConfig.i18n, "$.globalConfig.i18n", issues)
    ) {
      // Nested diagnostic is enough.
    }
    if (!requireRecord(globalConfig.variables, "$.globalConfig.variables", issues)) {
      // Nested diagnostic is enough.
    } else {
      validateJsonValue(globalConfig.variables, "$.globalConfig.variables", issues);
    }
  }

  const spec = requireRecord(value.spec, "$.spec", issues) ? value.spec : undefined;
  if (spec) {
    requireString(spec.root, "$.spec.root", issues);
    const elements = requireRecord(spec.elements, "$.spec.elements", issues)
      ? spec.elements
      : undefined;
    if (elements) {
      for (const [id, element] of Object.entries(elements)) {
        validateElement(element, `$.spec.elements.${id}`, issues);
      }

      if (typeof spec.root === "string" && !(spec.root in elements)) {
        issues.push({ path: "$.spec.root", message: "必须引用一个已存在的元素" });
      }

      const references = new Map<string, string[]>();
      for (const [id, element] of Object.entries(elements)) {
        const addReferences = (children: unknown, owner: string) => {
          if (!Array.isArray(children)) return;
          for (const child of children) {
            if (typeof child !== "string") continue;
            const owners = references.get(child) ?? [];
            owners.push(owner);
            references.set(child, owners);
            if (!(child in elements)) {
              issues.push({
                path: `$.spec.elements.${id}`,
                message: `引用了不存在的元素 ${child}`,
              });
            }
          }
        };
        if (isRecord(element)) {
          addReferences(element.children, id);
          if (isRecord(element.slots)) {
            for (const [slot, children] of Object.entries(element.slots)) {
              addReferences(children, `${id}.slots.${slot}`);
            }
          }
        }
      }

      const visiting = new Set<string>();
      const visited = new Set<string>();
      const walk = (id: string) => {
        if (visiting.has(id)) {
          issues.push({ path: `$.spec.elements.${id}`, message: "元素树不能包含循环引用" });
          return;
        }
        if (visited.has(id) || !elements[id]) return;
        visiting.add(id);
        const elementValue = elements[id];
        if (!isRecord(elementValue)) return;
        const element = elementValue;
        const children = [
          ...(Array.isArray(element.children) ? element.children : []),
          ...(isRecord(element.slots)
            ? Object.values(element.slots).flatMap((slot) => (Array.isArray(slot) ? slot : []))
            : []),
        ];
        children.forEach((child) => walk(child));
        visiting.delete(id);
        visited.add(id);
      };
      if (typeof spec.root === "string") walk(spec.root);

      for (const [id, owners] of references) {
        if (owners.length > 1) {
          issues.push({
            path: `$.spec.elements.${id}`,
            message: `元素被多个父节点引用：${owners.join(", ")}`,
          });
        }
      }
    }

    if (spec.state !== undefined) {
      if (!requireRecord(spec.state, "$.spec.state", issues)) {
        // Nested diagnostic is enough.
      } else {
        validateJsonValue(spec.state, "$.spec.state", issues);
      }
    }
  }

  return issues.length === 0
    ? { valid: true, issues, document: value as unknown as AppDocument }
    : { valid: false, issues };
}

export function createStarterDocument(): AppDocument {
  return {
    schemaVersion: "1.0",
    pageInfo: {
      title: "Product launch",
      description: "A starter document rendered from JSON.",
      keywords: ["studio", "json-render"],
      locale: "en-US",
      metadata: {},
    },
    globalConfig: {
      design: { width: 1200 },
      body: { className: "bg-[#f7f8fa]" },
      i18n: { defaultLocale: "en-US" },
      variables: {
        audience: "designers",
        session: { signedIn: true },
      },
    },
    spec: {
      root: "page",
      state: {
        lang: "en-US",
        i18n: {
          "en-US": {
            brand: "Northstar",
            eyebrow: "JSON-first design system",
            heroTitle: "Shape the interface before the code.",
            heroCopy: "Studio edits a portable document and lets an Adapter decide how it renders.",
            primaryCta: "Explore the canvas",
            secondaryCta: "Read the contract",
            featureTitle: "Everything stays inspectable",
            featureCopy: "Props, slots, state and translations remain visible as structured JSON.",
            inputLabel: "Workspace name",
            inputPlaceholder: "Try a state binding",
          },
          "zh-CN": {
            brand: "Northstar",
            eyebrow: "JSON 优先的设计系统",
            heroTitle: "先定义界面，再决定代码。",
            heroCopy: "Studio 编辑可迁移的文档，由 Adapter 决定具体如何渲染。",
            primaryCta: "探索画布",
            secondaryCta: "阅读契约",
            featureTitle: "一切都可检查",
            featureCopy: "属性、插槽、状态和翻译都保留为结构化 JSON。",
            inputLabel: "工作区名称",
            inputPlaceholder: "试试状态绑定",
          },
        },
        user: { name: "Alex" },
      },
      elements: {
        page: {
          type: "Container",
          name: "Page",
          props: { gap: "20px", padding: "24px", background: "#f7f8fa" },
          children: ["header", "hero", "featureCard"],
        },
        header: {
          type: "Container",
          name: "Header",
          props: { layout: "row", gap: "16px", padding: "10px 4px", align: "center" },
          slots: { left: ["brand"], right: ["headerAction"] },
        },
        brand: {
          type: "Text",
          name: "Brand",
          props: { content: { $t: "brand" }, as: "strong", tone: "default" },
        },
        headerAction: {
          type: "Button",
          name: "Header action",
          props: { label: "Preview", variant: "ghost", size: "sm" },
        },
        hero: {
          type: "Container",
          name: "Hero",
          props: {
            gap: "18px",
            padding: "56px",
            background: "#111827",
            color: "#f9fafb",
            radius: "24px",
          },
          children: ["eyebrow", "title", "copy", "actions"],
        },
        eyebrow: {
          type: "Text",
          name: "Eyebrow",
          props: { content: { $t: "eyebrow" }, tone: "accent", size: "sm" },
        },
        title: {
          type: "Text",
          name: "Title",
          props: { content: { $t: "heroTitle" }, as: "h1", size: "4xl", weight: "bold" },
        },
        copy: {
          type: "Text",
          name: "Copy",
          props: { content: { $t: "heroCopy" }, tone: "muted", size: "lg" },
        },
        actions: {
          type: "Container",
          name: "Actions",
          props: { layout: "row", gap: "10px", align: "center" },
          children: ["primary", "secondary"],
        },
        primary: {
          type: "Button",
          name: "Primary CTA",
          props: { label: { $t: "primaryCta" }, variant: "default", size: "lg" },
        },
        secondary: {
          type: "Button",
          name: "Secondary CTA",
          props: { label: { $t: "secondaryCta" }, variant: "outline", size: "lg" },
        },
        featureCard: {
          type: "Container",
          name: "Feature card",
          props: {
            gap: "12px",
            padding: "24px",
            background: "#ffffff",
            radius: "18px",
            border: "1px solid #e5e7eb",
          },
          children: ["featureTitle", "featureCopy", "workspaceInput"],
        },
        featureTitle: {
          type: "Text",
          name: "Feature title",
          props: { content: { $t: "featureTitle" }, as: "h2", size: "xl", weight: "semibold" },
        },
        featureCopy: {
          type: "Text",
          name: "Feature copy",
          props: { content: { $t: "featureCopy" }, tone: "muted" },
        },
        workspaceInput: {
          type: "Input",
          name: "Workspace input",
          props: {
            label: { $t: "inputLabel" },
            placeholder: { $t: "inputPlaceholder" },
            value: { $bindState: "/user/name" },
          },
        },
      },
    },
  };
}
