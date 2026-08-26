import type { AppManifest } from "@openscene-ai/core";

import type { AdapterMeta, ComponentMeta, EditorMeta, PropMeta } from "./meta";
import { isRecord, type DynamicMode, type JsonValue } from "./document";

function jsonValue(value: unknown): JsonValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    const values = value.map(jsonValue);
    return values.every((item) => item !== undefined) ? (values as JsonValue[]) : undefined;
  }
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).map(([key, child]) => [key, jsonValue(child)] as const);
  if (entries.some(([, child]) => child === undefined)) return undefined;
  return Object.fromEntries(entries) as JsonValue;
}

function schemaValue(value: unknown): Record<string, unknown> {
  const source = isRecord(value) ? value : {};
  const branches = [
    ...(Array.isArray(source.anyOf) ? source.anyOf : []),
    ...(Array.isArray(source.oneOf) ? source.oneOf : []),
  ].filter(isRecord);
  if (branches.length === 0) return source;

  const preferred =
    branches.find((branch) => Array.isArray(branch.enum) || Array.isArray(branch.options)) ??
    branches.find((branch) => typeof branch.type === "string") ??
    branches[0];
  const base = Object.fromEntries(
    Object.entries(source).filter(([key]) => key !== "anyOf" && key !== "oneOf"),
  );
  return { ...base, ...schemaValue(preferred) };
}

function editorValue(value: unknown): Record<string, unknown> {
  if (typeof value === "string") return { control: value };
  return isRecord(value) ? value : {};
}

function editorMeta(value: unknown, property: Record<string, unknown>): EditorMeta {
  const candidate = editorValue(value ?? property["x-editor"]);
  const legacy = isRecord(property.meta) ? property.meta : {};
  const type = typeof property.type === "string" ? property.type.toLowerCase() : "";
  const enumValues = Array.isArray(property.enum) ? property.enum : [];
  const enumNames = Array.isArray(property.enumNames) ? property.enumNames : [];
  const rawUnits = candidate.units ?? property["x-units"];
  const rawKeywords = candidate.keywords ?? property["x-keywords"];
  const control =
    typeof candidate.control === "string"
      ? candidate.control
      : typeof legacy.control === "string"
        ? legacy.control
        : candidate.type === "style" || type === "style"
          ? "style"
          : enumValues.length > 0 || Array.isArray(candidate.options) || type === "enum"
            ? "select"
            : type === "color" ||
                (typeof property.title === "string" && /color/i.test(property.title))
              ? "color"
              : type === "key-value" || type === "keyvalue" || type === "key_value"
                ? "key-value"
                : type === "array"
                  ? "array"
                  : type === "object"
                    ? "object"
                    : /bool/i.test(type)
                      ? "boolean"
                      : /integer/i.test(type)
                        ? "integer"
                        : /number/i.test(type)
                          ? "number"
                          : "text";

  const options = Array.isArray(candidate.options)
    ? candidate.options
        .filter(
          (option): option is { label: string; value: JsonValue } =>
            isRecord(option) &&
            typeof option.label === "string" &&
            jsonValue(option.value) !== undefined,
        )
        .map((option) => ({ label: option.label, value: jsonValue(option.value) as JsonValue }))
    : enumValues.flatMap((option, index) => {
        const normalized = jsonValue(option);
        return normalized === undefined
          ? []
          : [{ label: String(enumNames[index] ?? option), value: normalized }];
      });

  return {
    ...candidate,
    control,
    options: options.length > 0 ? options : undefined,
    units: Array.isArray(rawUnits)
      ? rawUnits.filter((unit): unit is string => typeof unit === "string")
      : undefined,
    keywords: Array.isArray(rawKeywords)
      ? rawKeywords.filter((keyword): keyword is string => typeof keyword === "string")
      : undefined,
  };
}

function propMeta(name: string, value: unknown): PropMeta {
  const property = schemaValue(value);
  const legacy = isRecord(property.meta) ? property.meta : {};
  const declaredDynamic = Array.isArray(property.dynamic)
    ? property.dynamic
    : Array.isArray(property.bindings)
      ? property.bindings
      : [];
  const dynamicModes = declaredDynamic.filter(
    (mode): mode is DynamicMode =>
      mode === "state" || mode === "bindState" || mode === "template" || mode === "i18n",
  );
  if (
    (property.translatable === true || legacy.translatable === true) &&
    !dynamicModes.includes("i18n")
  ) {
    dynamicModes.push("i18n");
  }
  const dynamic = dynamicModes.length > 0 ? dynamicModes : undefined;
  const defaultValue = jsonValue(property.default);
  const result: PropMeta = {
    title:
      typeof property.title === "string"
        ? property.title
        : typeof legacy.label === "string"
          ? legacy.label
          : name,
    description: typeof property.description === "string" ? property.description : undefined,
    valueType: typeof property.type === "string" ? property.type : "unknown",
    required: property.required === true || legacy.required === true,
    translatable: property.translatable === true || legacy.translatable === true,
    editor: editorMeta(property.editor, property),
    dynamic,
    runtime: isRecord(property.runtime)
      ? {
          prop: typeof property.runtime.prop === "string" ? property.runtime.prop : undefined,
          toRuntime:
            typeof property.runtime.toRuntime === "string" ? property.runtime.toRuntime : undefined,
          fromRuntime:
            typeof property.runtime.fromRuntime === "string"
              ? property.runtime.fromRuntime
              : undefined,
        }
      : undefined,
  };
  if (defaultValue !== undefined) result.default = defaultValue;
  return result;
}

function componentMeta(type: string, value: unknown): ComponentMeta {
  const component = isRecord(value) ? value : {};
  const rawProps = schemaValue(component.props);
  const propsSource = isRecord(rawProps.properties) ? rawProps.properties : rawProps;
  const props = isRecord(propsSource)
    ? Object.fromEntries(
        Object.entries(propsSource).map(([name, property]) => [name, propMeta(name, property)]),
      )
    : {};
  const rawSlots = component.slots;
  const slots = Array.isArray(rawSlots)
    ? Object.fromEntries(
        rawSlots
          .filter((slot): slot is string => typeof slot === "string")
          .map((slot) => [slot, { title: slot }]),
      )
    : isRecord(rawSlots)
      ? (rawSlots as ComponentMeta["slots"])
      : undefined;

  return {
    type,
    title:
      typeof component.title === "string"
        ? component.title
        : typeof component.name === "string"
          ? component.name
          : type,
    description: typeof component.description === "string" ? component.description : undefined,
    category: typeof component.category === "string" ? component.category : "Components",
    tags: Array.isArray(component.tags)
      ? component.tags.filter((tag): tag is string => typeof tag === "string")
      : undefined,
    runtime: {
      component:
        isRecord(component.runtime) && typeof component.runtime.component === "string"
          ? component.runtime.component
          : type,
      propMap:
        isRecord(component.runtime) && isRecord(component.runtime.propMap)
          ? Object.fromEntries(
              Object.entries(component.runtime.propMap).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string",
              ),
            )
          : undefined,
      eventMap:
        isRecord(component.runtime) && isRecord(component.runtime.eventMap)
          ? Object.fromEntries(
              Object.entries(component.runtime.eventMap).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string",
              ),
            )
          : undefined,
    },
    props,
    events: isRecord(component.events) ? (component.events as ComponentMeta["events"]) : undefined,
    slots,
    capabilities: Array.isArray(component.capabilities)
      ? component.capabilities.filter(
          (capability): capability is string => typeof capability === "string",
        )
      : undefined,
  };
}

export function materialManifestToAdapterMeta(manifest: AppManifest | null): AdapterMeta {
  const components = manifest?.components ?? {};
  return {
    id: manifest ? `app:${manifest.app.key}` : "app:unavailable",
    title: manifest ? `${manifest.app.key} materials` : "No App materials",
    description: manifest
      ? "Component Meta supplied by the target App manifest. Studio does not persist this catalog."
      : "Open Studio from an App session to load its material manifest.",
    components: Object.entries(components).map(([type, value]) => componentMeta(type, value)),
  };
}
