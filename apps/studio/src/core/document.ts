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

export function getBindingType(elementType: string, propKey: string): "state" | "bindState" {
  const normalizedType = elementType.toLowerCase();
  if (
    (normalizedType === "input" || normalizedType === "select" || normalizedType === "textarea") &&
    propKey === "value"
  ) {
    return "bindState";
  }
  if (normalizedType === "checkbox" && propKey === "checked") return "bindState";
  if (normalizedType === "dialog" && propKey === "open") return "bindState";
  return "state";
}

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
  return { $t: normalizeI18nPath(value) };
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

export function normalizeI18nPath(key: string): string {
  const trimmed = key.trim();
  if (trimmed.startsWith("/i18n/$lang/")) return trimmed;
  const cleanKey = trimmed.replace(/^\/+/, "").replace(/\/+/g, "/");
  return `/i18n/$lang/${cleanKey}`;
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
    if (key !== "i18n" && key !== "__scene") {
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

  const reference = normalizeI18nPath(key);
  const translationKey = reference.slice("/i18n/$lang/".length);
  if (translationKey in dictionary) return dictionary[translationKey];
  let current: JsonValue = dictionary;
  for (const segment of translationKey.split(/[./]/).filter(Boolean)) {
    if (!isRecord(current) || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
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
    if (typeof spec.root !== "string") {
      issues.push({
        path: "$.spec.root",
        message: "必须是元素 ID 字符串，空字符串表示尚未创建 root",
      });
    }
    const elements = requireRecord(spec.elements, "$.spec.elements", issues)
      ? spec.elements
      : undefined;
    if (elements) {
      for (const [id, element] of Object.entries(elements)) {
        validateElement(element, `$.spec.elements.${id}`, issues);
      }

      if (typeof spec.root === "string" && spec.root !== "" && !(spec.root in elements)) {
        issues.push({ path: "$.spec.root", message: "必须引用一个已存在的元素" });
      }
      if (typeof spec.root === "string" && spec.root === "" && Object.keys(elements).length > 0) {
        issues.push({
          path: "$.spec.root",
          message: "有元素时必须指定 root；空文档可暂时保持空字符串",
        });
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

export function normalizeAppDocument(value: unknown): AppDocument {
  const source = isRecord(value) ? value : {};
  const pageInfo = isRecord(source.pageInfo) ? source.pageInfo : {};
  const globalConfig = isRecord(source.globalConfig) ? source.globalConfig : {};
  const rawSpec = isRecord(source.spec) ? source.spec : {};
  const rawElements = isRecord(rawSpec.elements) ? rawSpec.elements : {};
  const rawDesign = isRecord(globalConfig.design) ? globalConfig.design : {};
  const elements = Object.fromEntries(
    Object.entries(rawElements)
      .filter(([, element]) => isRecord(element))
      .map(([id, element]) => [id, element as unknown as AppElement]),
  );

  return {
    schemaVersion: typeof source.schemaVersion === "string" ? source.schemaVersion : "1.0",
    pageInfo: {
      title: typeof pageInfo.title === "string" ? pageInfo.title : "Untitled",
      description: typeof pageInfo.description === "string" ? pageInfo.description : "",
      keywords: Array.isArray(pageInfo.keywords)
        ? pageInfo.keywords.filter((keyword): keyword is string => typeof keyword === "string")
        : [],
      locale: typeof pageInfo.locale === "string" ? pageInfo.locale : "en-US",
      metadata: isRecord(pageInfo.metadata) ? (pageInfo.metadata as Record<string, JsonValue>) : {},
    },
    globalConfig: {
      design: {
        width: typeof rawDesign.width === "number" ? rawDesign.width : null,
      },
      body: {
        className:
          isRecord(globalConfig.body) && typeof globalConfig.body.className === "string"
            ? globalConfig.body.className
            : undefined,
        styles:
          isRecord(globalConfig.body) && isRecord(globalConfig.body.styles)
            ? (globalConfig.body.styles as Record<string, JsonValue>)
            : undefined,
      },
      css:
        isRecord(globalConfig.css) && isRecord(globalConfig.css.rules)
          ? (globalConfig.css as AppDocument["globalConfig"]["css"])
          : undefined,
      i18n:
        isRecord(globalConfig.i18n) && typeof globalConfig.i18n.defaultLocale === "string"
          ? { defaultLocale: globalConfig.i18n.defaultLocale }
          : undefined,
      variables: isRecord(globalConfig.variables)
        ? (globalConfig.variables as Record<string, JsonValue>)
        : {},
    },
    spec: {
      root: typeof rawSpec.root === "string" ? rawSpec.root : "",
      elements,
      state: isRecord(rawSpec.state) ? (rawSpec.state as Record<string, JsonValue>) : {},
    },
  };
}
