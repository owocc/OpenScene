import { createContext, useContext } from "solid-js";
import type { JSX } from "solid-js";

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

export function View(props: PrimitiveProps): JSX.Element {
  const node = useOpenSceneNode();
  const className =
    typeof props.props.className === "string"
      ? props.props.className
      : typeof props.props.class === "string"
        ? props.props.class
        : undefined;
  const style = props.props.style;
  return (
    <div {...node.nodeAttrs} class={className} style={style as JSX.CSSProperties}>
      {props.children}
    </div>
  );
}

export function Text(props: PrimitiveProps): JSX.Element {
  const node = useOpenSceneNode();
  const text = typeof props.props.text === "string" ? props.props.text : undefined;
  return <span {...node.nodeAttrs}>{text ?? props.children}</span>;
}

export function Button(props: PrimitiveProps): JSX.Element {
  const node = useOpenSceneNode();
  const label = typeof props.props.label === "string" ? props.props.label : undefined;
  const disabled = props.props.disabled === true;
  const type =
    props.props.type === "submit" || props.props.type === "reset" ? props.props.type : "button";
  const handleClick = (event: MouseEvent) => {
    const press = props.on("press");
    if (press.shouldPreventDefault) event.preventDefault();
    press.emit();
  };
  return (
    <button {...node.nodeAttrs} type={type} disabled={disabled} onClick={handleClick}>
      {label ?? props.children}
    </button>
  );
}
