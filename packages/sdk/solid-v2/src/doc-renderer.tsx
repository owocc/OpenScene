import { createMemo, For, Show, type Element as SolidElement } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Dynamic } from "@solidjs/web";
import { evaluateDynamicValue } from "@openscene-ai/javascript";
import type { SceneDocument, UIElement } from "@openscene-ai/core";
import { useRuntime } from "./runtime-ctx.tsx";

// Strip the private node-id injected by Studio so components don't see it.
function cleanProps(element: UIElement): Record<string, unknown> {
  const raw = { ...(element.props as Record<string, unknown>) };
  delete raw["__opensceneNodeId"];
  return raw;
}

function privateNodeId(element: UIElement): string | null {
  const id = (element.props as Record<string, unknown>)["__opensceneNodeId"];
  return typeof id === "string" ? id : null;
}

interface ElementRendererProps {
  elementId: string;
  elements: SceneDocument["spec"]["elements"];
  state: Record<string, unknown>;
}
function ElementRenderer(props: ElementRendererProps): SolidElement {
  const { app, dispatchAction } = useRuntime();

  const element = createMemo(() => props.elements[props.elementId]);

  const isVisible = createMemo(() => {
    const el = element();
    if (!el || el.visible == null) return true;
    return Boolean(evaluateDynamicValue(el.visible, props.state));
  });

  const resolvedProps = createMemo(() => {
    const el = element();
    if (!el) return {};
    return evaluateDynamicValue(cleanProps(el), props.state) as Record<string, unknown>;
  });

  const nodeId = createMemo(() => {
    const el = element();
    return el ? (privateNodeId(el) ?? props.elementId) : props.elementId;
  });

  const Component = createMemo(() => {
    const el = element();
    return el ? app.registry[el.type] : undefined;
  });

  return (() => {
    const el = element();
    if (!isVisible() || !el) return null;

    const childrenEl = (
      <For each={el.children ?? []}>
        {(childId) => (
          <ElementRenderer elementId={childId} elements={props.elements} state={props.state} />
        )}
      </For>
    );

    const comp = Component();
    if (!comp) {
      return (
        <div
          data-missing-component={el.type}
          style="outline: 1px dashed rgba(255,80,80,0.5); padding: 2px;"
        >
          {childrenEl}
        </div>
      );
    }

    return (
      <span data-node-id={nodeId()} style={{ display: "contents" }}>
        <Dynamic component={comp} {...resolvedProps()} dispatchAction={dispatchAction}>
          {childrenEl}
        </Dynamic>
      </span>
    );
  }) as unknown as SolidElement;
}

export interface DocumentRendererProps {
  document: SceneDocument;
}

export function DocumentRenderer(props: DocumentRendererProps): JSX.Element {
  const { state } = useRuntime();
  const root = createMemo(() => props.document.spec.root);

  return (
    <Show when={root()}>
      {(rootId) => (
        <ElementRenderer
          elementId={rootId()}
          elements={props.document.spec.elements}
          state={state()}
        />
      )}
    </Show>
  );
}
