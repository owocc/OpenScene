import type { JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { useRuntime } from "./context.js";
import { evaluateDynamicValue } from "./evaluate.js";
import { commonStyleToCss } from "./styles.js";
import type {
  CommonStyles,
  ComponentRegistry,
  ComponentRenderContext,
  DynamicValue,
  ElementProps,
  StateWriteBinding,
} from "./types.js";

export type { ComponentRenderContext } from "./types.js";
export function resolveComponentProps<T extends Record<string, unknown>>(
  props: T,
  state: Record<string, unknown>,
): T {
  return evaluateDynamicValue(props, state) as T;
}
export function getComponentAttributes(
  props: ElementProps,
  state: Record<string, unknown>,
): { id?: string; class?: string; "aria-label"?: string; style: JSX.CSSProperties } {
  const evaluated = resolveComponentProps(props, state);
  return {
    id: typeof evaluated.id === "string" ? evaluated.id : undefined,
    class: typeof evaluated.className === "string" ? evaluated.className : undefined,
    "aria-label": typeof evaluated.ariaLabel === "string" ? evaluated.ariaLabel : undefined,
    style: {
      ...commonStyleToCss(evaluated.styles as CommonStyles | undefined),
      ...(evaluated.style as JSX.CSSProperties | undefined),
    },
  };
}

export interface ViewProps extends ElementProps {
  as?: string;
}
export function View(context: ComponentRenderContext<ViewProps>): JSX.Element {
  const { state } = useRuntime();
  return (
    <Dynamic
      component={resolveComponentProps(context.props, state()).as || "div"}
      data-openscene-element-id={context.elementId}
      {...getComponentAttributes(context.props, state())}
    >
      {context.children}
    </Dynamic>
  );
}
export interface TextProps extends ElementProps {
  as?: "p" | "span" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div" | "label";
  content?: string | number;
}
export function Text(context: ComponentRenderContext<TextProps>): JSX.Element {
  const { state } = useRuntime();
  const evaluated = () => resolveComponentProps(context.props, state());
  return (
    <Dynamic
      component={evaluated().as || "span"}
      data-openscene-element-id={context.elementId}
      {...getComponentAttributes(context.props, state())}
    >
      {evaluated().content !== undefined ? String(evaluated().content) : context.children}
    </Dynamic>
  );
}
export interface ImageProps extends ElementProps {
  src?: string;
  alt?: string;
  fit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  width?: string | number;
  height?: string | number;
}
export function Image(context: ComponentRenderContext<ImageProps>): JSX.Element {
  const { state } = useRuntime();
  const evaluated = () => resolveComponentProps(context.props, state());
  const attrs = () => getComponentAttributes(context.props, state());
  return (
    <img
      src={evaluated().src}
      alt={evaluated().alt || ""}
      width={evaluated().width}
      height={evaluated().height}
      id={attrs().id}
      class={attrs().class}
      aria-label={attrs()["aria-label"]}
      data-openscene-element-id={context.elementId}
      style={{ ...attrs().style, "object-fit": evaluated().fit || "cover", display: "block" }}
    />
  );
}
export interface ButtonProps extends ElementProps {
  text?: string;
  disabled?: boolean;
  action?: { name: string; params?: Record<string, unknown> };
  onClick?: () => void;
}
export function Button(context: ComponentRenderContext<ButtonProps>): JSX.Element {
  const { state, dispatchAction } = useRuntime();
  const evaluated = () => resolveComponentProps(context.props, state());
  const attrs = () => getComponentAttributes(context.props, state());
  const handleClick = (event: MouseEvent) => {
    event.preventDefault();
    if (evaluated().disabled) return;
    if (evaluated().action)
      void dispatchAction(evaluated().action!.name, evaluated().action!.params);
    context.props.onClick?.();
  };
  return (
    <button
      type="button"
      id={attrs().id}
      class={attrs().class}
      data-openscene-element-id={context.elementId}
      aria-label={attrs()["aria-label"]}
      disabled={evaluated().disabled}
      style={{
        cursor: "pointer",
        "user-select": "none",
        border: "none",
        outline: "none",
        "font-family": "inherit",
        "font-size": "inherit",
        ...attrs().style,
      }}
      onClick={handleClick}
    >
      {evaluated().text !== undefined ? String(evaluated().text) : context.children}
    </button>
  );
}
export interface InputProps extends ElementProps {
  value?: DynamicValue<string | number>;
  placeholder?: string;
  type?: "text" | "number" | "password" | "email";
  disabled?: boolean;
}
export function Input(context: ComponentRenderContext<InputProps>): JSX.Element {
  const { state, setStateByPath } = useRuntime();
  const evaluated = () => resolveComponentProps(context.props, state());
  const attrs = () => getComponentAttributes(context.props, state());
  const inputValue = () => {
    const value = evaluated().value;
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  };
  const bindPath = () => {
    const value = context.props.value;
    return typeof value === "object" &&
      value !== null &&
      "$bindState" in value &&
      typeof value.$bindState === "string"
      ? (value as StateWriteBinding).$bindState
      : undefined;
  };
  const handleInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (event) => {
    const path = bindPath();
    if (path)
      setStateByPath(
        path,
        evaluated().type === "number"
          ? Number(event.currentTarget.value)
          : event.currentTarget.value,
      );
  };
  return (
    <input
      type={evaluated().type || "text"}
      value={inputValue()}
      placeholder={evaluated().placeholder || ""}
      data-openscene-element-id={context.elementId}
      disabled={evaluated().disabled}
      id={attrs().id}
      class={attrs().class}
      aria-label={attrs()["aria-label"]}
      style={{
        outline: "none",
        "font-family": "inherit",
        "font-size": "inherit",
        "box-sizing": "border-box",
        ...attrs().style,
      }}
      onInput={handleInput}
    />
  );
}
export const defaultRegistry: ComponentRegistry = {
  View: View as ComponentRegistry[string],
  Text: Text as ComponentRegistry[string],
  Image: Image as ComponentRegistry[string],
  Button: Button as ComponentRegistry[string],
  Input: Input as ComponentRegistry[string],
};
