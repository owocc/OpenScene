import type { JSX } from "solid-js";
import { isObjectRecord } from "./guards.js";
import type { CommonStyles, GlobalConfig, UnitValue } from "./types.js";

export function isUnitValue(value: unknown): value is UnitValue {
  return isObjectRecord(value) && typeof value.value === "number" && typeof value.unit === "string";
}

export function toCssValue(value: unknown): string | number | undefined {
  if (value === null || value === undefined) return undefined;
  if (isUnitValue(value)) {
    if (value.unit === "design")
      return `calc(${value.value} / var(--scene-design-width, 375) * 100vw)`;
    return `${value.value}${{ dh: "dvh", dw: "dvw", vm: "vmin" }[value.unit] ?? value.unit}`;
  }
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

const spacingKeys: Record<string, true> = {
  margin: true,
  marginX: true,
  marginY: true,
  marginTop: true,
  marginRight: true,
  marginBottom: true,
  marginLeft: true,
  padding: true,
  paddingX: true,
  paddingY: true,
  paddingTop: true,
  paddingRight: true,
  paddingBottom: true,
  paddingLeft: true,
};
const directional = [
  ["marginTop", "margin-top"],
  ["marginRight", "margin-right"],
  ["marginBottom", "margin-bottom"],
  ["marginLeft", "margin-left"],
  ["paddingTop", "padding-top"],
  ["paddingRight", "padding-right"],
  ["paddingBottom", "padding-bottom"],
  ["paddingLeft", "padding-left"],
] as const;

export function commonStyleToCss(
  styles?: CommonStyles | Record<string, unknown>,
): JSX.CSSProperties {
  if (!styles) return {};
  const output: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(styles)) {
    if (spacingKeys[key]) continue;
    const cssValue = toCssValue(value);
    if (cssValue !== undefined)
      output[key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)] = cssValue;
  }
  for (const key of ["margin", "padding"] as const) {
    const cssValue = toCssValue(styles[key]);
    if (cssValue !== undefined) output[key] = cssValue;
  }
  for (const [axis, sides] of [
    ["marginX", ["margin-left", "margin-right"]],
    ["marginY", ["margin-top", "margin-bottom"]],
    ["paddingX", ["padding-left", "padding-right"]],
    ["paddingY", ["padding-top", "padding-bottom"]],
  ] as const) {
    const cssValue = toCssValue(styles[axis]);
    if (cssValue !== undefined) for (const side of sides) output[side] = cssValue;
  }
  for (const [property, cssProperty] of directional) {
    const cssValue = toCssValue(styles[property]);
    if (cssValue !== undefined) output[cssProperty] = cssValue;
  }
  return output as JSX.CSSProperties;
}

export function applyBodyConfig(config?: GlobalConfig): () => void {
  if (typeof document === "undefined" || !config) return () => undefined;
  const body = document.body;
  const previousStyles = new Map<string, string>();
  const previousVariables = new Map<string, string>();
  const setVariable = (name: string, value: string | number) => {
    previousVariables.set(name, body.style.getPropertyValue(name));
    body.style.setProperty(name, String(value));
  };
  if (typeof config.design?.width === "number" && config.design.width > 0)
    setVariable("--scene-design-width", config.design.width);
  for (const [name, value] of Object.entries(config.variables ?? {})) {
    const cssValue = toCssValue(value);
    if (cssValue !== undefined) setVariable(name, cssValue);
  }
  for (const [name, value] of Object.entries({
    ...commonStyleToCss(config.body?.styles),
    ...config.body?.style,
  })) {
    previousStyles.set(name, body.style.getPropertyValue(name));
    body.style.setProperty(name, String(value));
  }
  const classes = config.body?.className?.split(/\s+/).filter(Boolean) ?? [];
  body.classList.add(...classes);
  return () => {
    for (const [name, value] of previousStyles) {
      if (value) body.style.setProperty(name, value);
      else body.style.removeProperty(name);
    }
    for (const [name, value] of previousVariables) {
      if (value) body.style.setProperty(name, value);
      else body.style.removeProperty(name);
    }
    body.classList.remove(...classes);
  };
}
