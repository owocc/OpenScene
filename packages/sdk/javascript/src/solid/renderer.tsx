import { createMemo, onCleanup, onMount, Show, type JSX } from "solid-js";
import { defaultRegistry } from "./components.js";
import { RuntimeProvider, useRuntime } from "./context.js";
import { evaluateDynamicValue } from "./evaluate.js";
import { useSceneEditorBridge } from "./editor-bridge.js";
import { applyBodyConfig } from "./styles.js";
import type {
  ActionHandler,
  ComponentRegistry,
  SceneDocument,
  Spec,
  SpecElement,
} from "./types.js";

export function normalizeSlotsInSpec(spec: Spec): Spec {
  const elements: Record<string, SpecElement> = {};
  for (const [key, element] of Object.entries(spec.elements)) {
    const children = [...(element.children ?? [])];
    const slotMap = { ...element.props?.__slotMap };
    for (const [slot, slotChildren] of Object.entries(element.slots ?? {}))
      for (const child of slotChildren) {
        if (!children.includes(child)) children.push(child);
        slotMap[child] = slot;
      }
    elements[key] = {
      ...element,
      children,
      props: { ...element.props, __slotMap: Object.keys(slotMap).length > 0 ? slotMap : undefined },
    };
  }
  return { ...spec, elements };
}

export function prepareDocument(document: SceneDocument): {
  spec: Spec;
  state: Record<string, unknown>;
} {
  return {
    spec: normalizeSlotsInSpec(document.spec),
    state: {
      ...(document.spec.state ? structuredClone(document.spec.state) : {}),
      __scene: { pageInfo: document.pageInfo ? structuredClone(document.pageInfo) : {} },
    },
  };
}

export function ElementRenderer(props: { elementId: string; spec: Spec }): JSX.Element {
  const { state, registry } = useRuntime();
  const element = () => props.spec.elements[props.elementId];
  const renderedChildren = createMemo(() => {
    const current = element();
    if (!current)
      return { children: [] as JSX.Element[], slots: {} as Record<string, JSX.Element> };
    const slotMap = current.props?.__slotMap ?? {};
    const children: JSX.Element[] = [];
    const slots: Record<string, JSX.Element[]> = {};
    for (const child of current.children ?? []) {
      const node = <ElementRenderer elementId={child} spec={props.spec} />;
      const slot = slotMap[child];
      if (slot && slot !== "default") (slots[slot] ??= []).push(node);
      else children.push(node);
    }
    return {
      children,
      slots: Object.fromEntries(
        Object.entries(slots).map(([name, nodes]) => [name, nodes.length === 1 ? nodes[0] : nodes]),
      ),
    };
  });
  const current = element();
  if (!current) return <></>;
  const Component = registry[current.type];
  const children = renderedChildren().children;
  const rendered = !Component ? (
    <div
      style={{
        padding: "8px 12px",
        margin: "4px 0",
        "font-size": "12px",
        color: "#ef4444",
        background: "#fef2f2",
        border: "1px dashed #f87171",
        "border-radius": "4px",
        "font-family": "monospace",
      }}
    >
      [Renderer Warning] Component "{current.type}" not found in registry (id: {props.elementId})
    </div>
  ) : (
    Component({
      elementId: props.elementId,
      elementType: current.type,
      props: current.props ?? {},
      children: children.length === 1 ? children[0] : children,
      slots: renderedChildren().slots,
    })
  );
  return (
    <Show when={Boolean(evaluateDynamicValue(current.visible ?? true, state()))}>{rendered}</Show>
  );
}

export interface JsonRendererProps {
  document?: SceneDocument | null;
  spec?: Spec | null;
  registry?: ComponentRegistry;
  actions?: Record<string, ActionHandler>;
  initialState?: Record<string, unknown>;
  onStateChange?: (changes: { path: string; value: unknown }[]) => void;
}
export function JsonRenderer(props: JsonRendererProps): JSX.Element {
  const prepared = createMemo(() =>
    props.document
      ? prepareDocument(props.document)
      : props.spec
        ? {
            spec: normalizeSlotsInSpec(props.spec),
            state: props.spec.state ? structuredClone(props.spec.state) : {},
          }
        : null,
  );
  const editorBridge = useSceneEditorBridge(props.document);
  const selectElementFromDom: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent> = (event) => {
    if (!editorBridge.enabled || !(event.target instanceof Element)) return;
    const elementId = event.target.closest<HTMLElement>("[data-openscene-element-id]")?.dataset
      .opensceneElementId;
    if (elementId) editorBridge.selectElement(elementId);
  };
  onMount(() => {
    if (props.document?.globalConfig) onCleanup(applyBodyConfig(props.document.globalConfig));
  });
  return (
    <Show
      when={prepared()?.spec}
      fallback={
        <div style={{ padding: "16px", color: "#94a3b8", "font-size": "14px" }}>
          没有可渲染的动态内容。
        </div>
      }
    >
      {(spec) => (
        <RuntimeProvider
          registry={{ ...defaultRegistry, ...props.registry }}
          initialState={{ ...prepared()?.state, ...props.initialState }}
          actions={props.actions}
          onStateChange={props.onStateChange}
        >
          <div style={{ width: "100%", "box-sizing": "border-box" }} onClick={selectElementFromDom}>
            <ElementRenderer elementId={spec().root} spec={spec()} />
          </div>
        </RuntimeProvider>
      )}
    </Show>
  );
}
export default JsonRenderer;
