import { isObjectRecord } from "./guards.js";

export function getValueByPointer(object: unknown, pointer: string): unknown {
  if (!pointer || pointer === "/") return object;
  if (!pointer.startsWith("/")) return undefined;
  return pointer
    .slice(1)
    .split("/")
    .reduce<unknown>((current, segment) => {
      if (current === null || typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[
        segment.replaceAll("~1", "/").replaceAll("~0", "~")
      ];
    }, object);
}

export function setValueByPointer(
  state: Record<string, unknown>,
  pointer: string,
  value: unknown,
): Record<string, unknown> {
  if (!pointer.startsWith("/")) return state;
  const segments = pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (segments.length === 0 || !segments[0]) return state;
  const next = structuredClone(state);
  let target: Record<string, unknown> = next;
  for (const segment of segments.slice(0, -1)) {
    const child = target[segment];
    if (child === null || typeof child !== "object" || Array.isArray(child)) target[segment] = {};
    target = target[segment] as Record<string, unknown>;
  }
  target[segments.at(-1)!] = value;
  return next;
}

export function resolveTranslation(
  key: string,
  state: Record<string, unknown>,
  defaultLocale = "en",
): string {
  const locale = typeof state.lang === "string" ? state.lang : defaultLocale;
  const value = getValueByPointer(state, `/i18n/${locale}/${key.replaceAll(".", "/")}`);
  return typeof value === "string" ? value : key;
}

export function resolveTemplate(template: string, state: Record<string, unknown>): string {
  return template.replaceAll(/\$\{([^}]+)\}/g, (_, pointer: string) => {
    const value = getValueByPointer(state, pointer);
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : "";
  });
}

export function isBinding(value: unknown): value is Record<string, string> {
  return (
    isObjectRecord(value) &&
    ["$state", "$bindState", "$t", "$page", "$template"].some(
      (key) => typeof value[key] === "string",
    )
  );
}

export function evaluateDynamicValue(value: unknown, state: Record<string, unknown>): unknown {
  if (isObjectRecord(value)) {
    if (typeof value.$state === "string") return getValueByPointer(state, value.$state);
    if (typeof value.$bindState === "string") return getValueByPointer(state, value.$bindState);
    if (typeof value.$t === "string") return resolveTranslation(value.$t, state);
    if (typeof value.$page === "string")
      return getValueByPointer(state, `/__scene/pageInfo/${value.$page}`);
    if (typeof value.$template === "string") return resolveTemplate(value.$template, state);
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, evaluateDynamicValue(item, state)]),
    );
  }
  if (Array.isArray(value)) return value.map((item) => evaluateDynamicValue(item, state));
  return value;
}
