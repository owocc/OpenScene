import type { SceneDocument } from "@openscene/protocol";

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

/** Canonical Studio document shape (protocol scene document). */
export type AppDocument = SceneDocument;

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
  if (trimmed === "" || trimmed === "/") {
    return "";
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

  const normalized = normalizeStatePath(path);
  if (!normalized) {
    return undefined;
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) {
    return undefined;
  }

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

  return dynamicValueText(value).replaceAll(
    /(?:\$\{|\{\{|\{)\s*([^}]+?)\s*(?:\}\}|\})/g,
    (_match, rawPath: string) => {
      const path = rawPath.trim();
      const resolved = readStatePath(state, path);
      if (resolved === undefined || resolved === null) return "";
      return typeof resolved === "object" ? JSON.stringify(resolved) : String(resolved);
    },
  );
}

export type StateVariableType = "string" | "number" | "boolean" | "object" | "array" | "null";

export interface StateVariable {
  key: string;
  value: JsonValue;
  type: StateVariableType;
  path: string;
}

export interface VariableReference {
  elementId: string;
  elementType: string;
  property: string;
  kind: "$state" | "$bindState" | "$template" | "other";
}

export function isValidVariableKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  if (isReservedStateRoot(trimmed)) return false;
  return /^[a-zA-Z_$][a-zA-Z0-9_$-]*$/.test(trimmed);
}

export function inferVariableType(value: unknown): StateVariableType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (typeof value === "object") return "object";
  return "string";
}

export function getDefaultVariableValue(type: StateVariableType): JsonValue {
  switch (type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "object":
      return {};
    case "array":
      return [];
    case "null":
      return null;
  }
}

export function convertVariableValue(value: unknown, targetType: StateVariableType): JsonValue {
  if (targetType === "null") return null;
  if (targetType === "string") {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (typeof value === "object") return JSON.stringify(value);
    return "";
  }
  if (targetType === "number") {
    if (typeof value === "number") return isNaN(value) ? 0 : value;
    if (typeof value === "boolean") return value ? 1 : 0;
    const parsed = Number(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (targetType === "boolean") {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true" || value === "1";
    if (typeof value === "number") return value !== 0;
    return Boolean(value);
  }
  if (targetType === "object") {
    if (isRecord(value)) return value as JsonObject;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (isRecord(parsed)) return parsed as JsonObject;
      } catch {}
    }
    return {};
  }
  if (targetType === "array") {
    if (Array.isArray(value)) return value as JsonValue[];
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed as JsonValue[];
      } catch {}
    }
    return [];
  }
  return getDefaultVariableValue(targetType);
}

export function getStateVariables(state: Record<string, unknown> | undefined): StateVariable[] {
  if (!state || !isRecord(state)) return [];
  const variables: StateVariable[] = [];
  for (const [key, value] of Object.entries(state)) {
    if (!isReservedStateRoot(key)) {
      variables.push({
        key,
        value: value as JsonValue,
        type: inferVariableType(value),
        path: `/${key}`,
      });
    }
  }
  return variables;
}

export function findVariableReferences(
  document: SceneDocument,
  variableKey: string,
): VariableReference[] {
  const references: VariableReference[] = [];
  const normalizedKey = variableKey.replace(/^\/+/, "");
  if (!normalizedKey) return references;

  const matchesPath = (path: string) => {
    const clean = path.replace(/^\/+/, "");
    return clean === normalizedKey || clean.startsWith(`${normalizedKey}/`);
  };

  const matchesTemplate = (template: string) => {
    const regex = new RegExp(
      `(?:$\{|{{|{)[^}]*?(?:\\/|\\$state\\.)?\\b${normalizedKey}\\b[^}]*?(?:\\}\\}|\\})`,
      "i",
    );
    return regex.test(template);
  };

  const scanValue = (val: unknown, elementId: string, elementType: string, currentPath: string) => {
    if (val === null || val === undefined) return;
    if (isDynamicValue(val)) {
      if ("$state" in val && typeof val.$state === "string" && matchesPath(val.$state)) {
        references.push({
          elementId,
          elementType,
          property: currentPath,
          kind: "$state",
        });
      } else if (
        "$bindState" in val &&
        typeof val.$bindState === "string" &&
        matchesPath(val.$bindState)
      ) {
        references.push({
          elementId,
          elementType,
          property: currentPath,
          kind: "$bindState",
        });
      } else if (
        "$template" in val &&
        typeof val.$template === "string" &&
        matchesTemplate(val.$template)
      ) {
        references.push({
          elementId,
          elementType,
          property: currentPath,
          kind: "$template",
        });
      }
      return;
    }

    if (Array.isArray(val)) {
      val.forEach((item, index) => {
        scanValue(item, elementId, elementType, `${currentPath}[${index}]`);
      });
    } else if (isRecord(val)) {
      for (const [propKey, childVal] of Object.entries(val)) {
        scanValue(
          childVal,
          elementId,
          elementType,
          currentPath ? `${currentPath}.${propKey}` : propKey,
        );
      }
    } else if (typeof val === "string" && matchesTemplate(val)) {
      references.push({
        elementId,
        elementType,
        property: currentPath,
        kind: "$template",
      });
    }
  };

  const elements = document.spec.elements ?? {};
  for (const [elementId, element] of Object.entries(elements)) {
    if (element.props) {
      scanValue(element.props, elementId, element.type, "props");
    }
    if (element.visible) {
      scanValue(element.visible, elementId, element.type, "visible");
    }
    if (element.repeat) {
      scanValue(element.repeat, elementId, element.type, "repeat");
    }
    if (element.watch) {
      scanValue(element.watch, elementId, element.type, "watch");
    }
    if (element.on) {
      scanValue(element.on, elementId, element.type, "on");
    }
  }

  return references;
}

export function setVariableInDocument(
  document: SceneDocument,
  key: string,
  value: unknown,
): SceneDocument {
  const currentSpec = document.spec;
  const currentState = (currentSpec.state ?? {}) as Record<string, unknown>;
  return {
    ...document,
    spec: {
      ...currentSpec,
      state: {
        ...currentState,
        [key]: value,
      },
    },
  };
}

export function deleteVariableInDocument(document: SceneDocument, key: string): SceneDocument {
  const currentSpec = document.spec;
  const currentState = { ...((currentSpec.state ?? {}) as Record<string, unknown>) };
  delete currentState[key];
  return {
    ...document,
    spec: {
      ...currentSpec,
      state: currentState,
    },
  };
}

export function renameVariableInDocument(
  document: SceneDocument,
  oldKey: string,
  newKey: string,
): SceneDocument {
  if (oldKey === newKey) return document;
  const currentSpec = document.spec;
  const currentState = { ...((currentSpec.state ?? {}) as Record<string, unknown>) };

  if (oldKey in currentState) {
    const val = currentState[oldKey];
    delete currentState[oldKey];
    currentState[newKey] = val;
  }

  const normalizedOld = oldKey.replace(/^\/+/, "");
  const normalizedNew = newKey.replace(/^\/+/, "");

  const updatePath = (path: string) => {
    const hasLeadingSlash = path.startsWith("/");
    const clean = path.replace(/^\/+/, "");
    if (clean === normalizedOld) {
      return hasLeadingSlash ? `/${normalizedNew}` : normalizedNew;
    }
    if (clean.startsWith(`${normalizedOld}/`)) {
      const rest = clean.slice(normalizedOld.length);
      return hasLeadingSlash ? `/${normalizedNew}${rest}` : `${normalizedNew}${rest}`;
    }
    return path;
  };

  const updateTemplate = (template: string) => {
    const regex = new RegExp(
      `((?:\\$\\{|\\{\\{|\\{)[^}]*?(?:\\/|\\$state\\.)?)\\b${normalizedOld}\\b([^}]*?(?:\\}\\}|\\}))`,
      "g",
    );
    return template.replace(regex, `$1${normalizedNew}$2`);
  };
  const transformValue = (val: unknown): unknown => {
    if (val === null || val === undefined) return val;
    if (isDynamicValue(val)) {
      if ("$state" in val && typeof val.$state === "string") {
        return { ...val, $state: updatePath(val.$state) };
      }
      if ("$bindState" in val && typeof val.$bindState === "string") {
        return { ...val, $bindState: updatePath(val.$bindState) };
      }
      if ("$template" in val && typeof val.$template === "string") {
        return { ...val, $template: updateTemplate(val.$template) };
      }
      return val;
    }
    if (Array.isArray(val)) {
      return val.map((item) => transformValue(item));
    }
    if (isRecord(val)) {
      const updated: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) {
        updated[k] = transformValue(v);
      }
      return updated;
    }
    if (typeof val === "string") {
      return updateTemplate(val);
    }
    return val;
  };

  const elements = { ...currentSpec.elements };
  for (const [elementId, element] of Object.entries(elements)) {
    elements[elementId] = {
      ...element,
      props: (element.props ? transformValue(element.props) : {}) as Record<string, unknown>,
      ...(element.visible ? { visible: transformValue(element.visible) } : {}),
      ...(element.repeat ? { repeat: transformValue(element.repeat) } : {}),
      ...(element.watch ? { watch: transformValue(element.watch) as Record<string, unknown> } : {}),
      ...(element.on ? { on: transformValue(element.on) as Record<string, unknown> } : {}),
    } as typeof element;
  }

  return {
    ...document,
    spec: {
      ...currentSpec,
      state: currentState,
      elements,
    },
  };
}
