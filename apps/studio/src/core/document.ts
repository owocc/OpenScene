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
