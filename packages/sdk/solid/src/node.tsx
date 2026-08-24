import { createContext, useContext } from "solid-js";
import type { JSX } from "solid-js";
import { evaluateDynamicValue } from "@openscene/javascript";
import { useOpenScene } from "./context.js";

export interface OpenSceneNodeContextValue {
  nodeId: string | null;
  nodeAttrs: { "data-node-id"?: string };
}

const OpenSceneNodeContext = createContext<OpenSceneNodeContextValue>({
  nodeId: null,
  nodeAttrs: {},
});

export function OpenSceneNodeProvider(props: {
  nodeId: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <OpenSceneNodeContext.Provider
      value={{ nodeId: props.nodeId, nodeAttrs: { "data-node-id": props.nodeId } }}
    >
      {props.children}
    </OpenSceneNodeContext.Provider>
  );
}

export function useOpenSceneNode(): OpenSceneNodeContextValue {
  return useContext(OpenSceneNodeContext);
}

export interface PrimitiveProps {
  props: Record<string, unknown>;
  children?: JSX.Element;
  emit: (event: string) => void;
  on: (event: string) => { emit: () => void; shouldPreventDefault: boolean; bound: boolean };
}

function useResolvedProps(rawProps: Record<string, unknown>): Record<string, unknown> {
  try {
    const context = useOpenScene();
    const state =
      context.snapshot().runtimeStore?.getSnapshot() ??
      (context.snapshot().document?.spec.state as Record<string, unknown> | undefined) ??
      {};
    return evaluateDynamicValue(rawProps, state) as Record<string, unknown>;
  } catch {
    return rawProps;
  }
}

export function View(props: PrimitiveProps): JSX.Element {
  const node = useOpenSceneNode();
  const resolved = () => useResolvedProps(props.props);
  const className = () =>
    typeof resolved().className === "string"
      ? (resolved().className as string)
      : typeof resolved().class === "string"
        ? (resolved().class as string)
        : undefined;
  const style = () => resolved().style;
  return (
    <div {...node.nodeAttrs} class={className()} style={style() as JSX.CSSProperties}>
      {props.children}
    </div>
  );
}

export function Text(props: PrimitiveProps): JSX.Element {
  const node = useOpenSceneNode();
  const resolved = () => useResolvedProps(props.props);
  const text = () => {
    const val = resolved().text ?? resolved().label;
    return typeof val === "string" || typeof val === "number" || typeof val === "boolean"
      ? String(val)
      : undefined;
  };
  const className = () =>
    typeof resolved().className === "string"
      ? (resolved().className as string)
      : typeof resolved().class === "string"
        ? (resolved().class as string)
        : undefined;
  const style = () => resolved().style;
  return (
    <span {...node.nodeAttrs} class={className()} style={style() as JSX.CSSProperties}>
      {text() ?? props.children}
    </span>
  );
}

export function Button(props: PrimitiveProps): JSX.Element {
  const node = useOpenSceneNode();
  const resolved = () => useResolvedProps(props.props);
  const label = () => {
    const val = resolved().label ?? resolved().text;
    return typeof val === "string" || typeof val === "number" || typeof val === "boolean"
      ? String(val)
      : undefined;
  };
  const className = () =>
    typeof resolved().className === "string"
      ? (resolved().className as string)
      : typeof resolved().class === "string"
        ? (resolved().class as string)
        : undefined;
  const style = () => resolved().style;
  const disabled = () => resolved().disabled === true;
  const type = () =>
    resolved().type === "submit" || resolved().type === "reset"
      ? (resolved().type as "submit" | "reset")
      : "button";
  const handleClick = (event: MouseEvent) => {
    const press = props.on("press");
    if (press.shouldPreventDefault) event.preventDefault();
    press.emit();
  };
  return (
    <button
      {...node.nodeAttrs}
      type={type()}
      disabled={disabled()}
      class={className()}
      style={style() as JSX.CSSProperties}
      onClick={handleClick}
    >
      {label() ?? props.children}
    </button>
  );
}
