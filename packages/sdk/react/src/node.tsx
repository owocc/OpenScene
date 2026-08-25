import React, { createContext, useContext, useMemo } from "react";
import { evaluateDynamicValue } from "@openscene-ai/javascript";
import { useOpenScene } from "./context.ts";

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
  children: React.ReactNode;
}): React.JSX.Element {
  const value = useMemo<OpenSceneNodeContextValue>(
    () => ({
      nodeId: props.nodeId || null,
      nodeAttrs: props.nodeId ? { "data-node-id": props.nodeId } : {},
    }),
    [props.nodeId],
  );

  return (
    <OpenSceneNodeContext.Provider value={value}>{props.children}</OpenSceneNodeContext.Provider>
  );
}

export function useOpenSceneNode(): OpenSceneNodeContextValue {
  return useContext(OpenSceneNodeContext);
}

export interface PrimitiveProps {
  props: Record<string, unknown>;
  children?: React.ReactNode;
  emit: (event: string) => void;
  on: (event: string) => { emit: () => void; shouldPreventDefault: boolean; bound: boolean };
}

export function useResolvedProps(rawProps: Record<string, unknown>): Record<string, unknown> {
  try {
    const context = useOpenScene();
    const doc = context.snapshot.document;
    const docState = (doc?.spec?.state as Record<string, unknown> | undefined) ?? {};
    const storeState = context.snapshot.runtimeStore?.getSnapshot() ?? {};
    const state = { ...docState, ...storeState };
    return evaluateDynamicValue(rawProps, state) as Record<string, unknown>;
  } catch {
    return rawProps;
  }
}

export function View(props: PrimitiveProps): React.JSX.Element {
  const node = useOpenSceneNode();
  const resolved = useResolvedProps(props.props);
  const className =
    typeof resolved.className === "string"
      ? (resolved.className as string)
      : typeof resolved.class === "string"
        ? (resolved.class as string)
        : undefined;
  const style = resolved.style as React.CSSProperties | undefined;

  return (
    <div {...node.nodeAttrs} className={className} style={style}>
      {props.children}
    </div>
  );
}

export function Text(props: PrimitiveProps): React.JSX.Element {
  const node = useOpenSceneNode();
  const resolved = useResolvedProps(props.props);
  const val = resolved.text ?? resolved.label;
  const text =
    typeof val === "string" || typeof val === "number" || typeof val === "boolean"
      ? String(val)
      : undefined;
  const className =
    typeof resolved.className === "string"
      ? (resolved.className as string)
      : typeof resolved.class === "string"
        ? (resolved.class as string)
        : undefined;
  const style = resolved.style as React.CSSProperties | undefined;

  return (
    <span {...node.nodeAttrs} className={className} style={style}>
      {text ?? props.children}
    </span>
  );
}

export function Button(props: PrimitiveProps): React.JSX.Element {
  const node = useOpenSceneNode();
  const resolved = useResolvedProps(props.props);
  const val = resolved.label ?? resolved.text;
  const label =
    typeof val === "string" || typeof val === "number" || typeof val === "boolean"
      ? String(val)
      : undefined;
  const className =
    typeof resolved.className === "string"
      ? (resolved.className as string)
      : typeof resolved.class === "string"
        ? (resolved.class as string)
        : undefined;
  const style = resolved.style as React.CSSProperties | undefined;
  const disabled = resolved.disabled === true;
  const type =
    resolved.type === "submit" || resolved.type === "reset"
      ? (resolved.type as "submit" | "reset")
      : "button";

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const press = props.on("press");
    if (press.shouldPreventDefault) event.preventDefault();
    press.emit();
  };

  return (
    <button
      {...node.nodeAttrs}
      type={type}
      disabled={disabled}
      className={className}
      style={style}
      onClick={handleClick}
    >
      {label ?? props.children}
    </button>
  );
}
