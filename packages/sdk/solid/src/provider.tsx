import {
  createEffect,
  createMemo,
  createSignal,
  ErrorBoundary,
  onCleanup,
  Show,
  type JSX,
  type Component,
} from "solid-js";
import {
  JSONUIProvider,
  Renderer,
  type ComponentRenderProps,
  type ComponentRegistry,
} from "@json-render/solid";
import type { Spec, UIElement } from "@json-render/core";
import {
  evaluateDynamicValue,
  openSceneDirectives,
  type OpenSceneClient,
  type OpenSceneClientState,
} from "@openscene/javascript";
import type { SceneDocument } from "@openscene/protocol";
import type { OpenSceneSolidApp } from "./catalog.js";
import { OpenSceneContext, useOpenScene } from "./context.js";
import { OpenSceneNodeProvider } from "./node.js";
import { SelectionCanvas } from "./selection.js";
export interface OpenSceneProviderProps {
  client?: OpenSceneClient;
  app: OpenSceneSolidApp;
  children?: JSX.Element;
}

function getDefaultClient(): OpenSceneClient {
  if (typeof window !== "undefined" && window.OpenScene) return window.OpenScene;
  throw new Error("OpenSceneProvider requires a client outside a browser runtime");
}

function subscribeClient(
  client: OpenSceneClient,
  setSnapshot: (value: OpenSceneClientState) => void,
): () => void {
  const unsubscribe = client.subscribe(() => setSnapshot(client.getSnapshot()));
  setSnapshot(client.getSnapshot());
  return unsubscribe;
}

function createRuntimeHandlers(
  app: OpenSceneSolidApp,
  store: OpenSceneClientState["runtimeStore"],
): Record<string, (params: Record<string, unknown>) => Promise<void>> | undefined {
  if (!store || !app.handlers) return undefined;
  const handlerFactory = app.handlers as unknown;
  if (typeof handlerFactory !== "function")
    return app.handlers as unknown as Record<
      string,
      (params: Record<string, unknown>) => Promise<void>
    >;
  const setState = (updater: (previous: Record<string, unknown>) => Record<string, unknown>) => {
    const previous = store.getSnapshot();
    const next = updater(previous);
    const updates: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
    for (const key of keys) {
      if (previous[key] !== next[key]) {
        const pointer = `/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
        updates[pointer] = next[key];
      }
    }
    store.update(updates);
  };
  return (
    handlerFactory as (
      getSetState: () => typeof setState,
      getState: () => Record<string, unknown>,
    ) => Record<string, (params: Record<string, unknown>) => Promise<void>>
  )(
    () => setState,
    () => store.getSnapshot(),
  );
}

export function OpenSceneProvider(props: OpenSceneProviderProps): JSX.Element {
  const client = props.client ?? getDefaultClient();
  const [snapshot, setSnapshot] = createSignal(client.getSnapshot(), { equals: false });
  createEffect(() => onCleanup(subscribeClient(client, setSnapshot)));
  const store = createMemo(() => snapshot().runtimeStore ?? undefined);
  const handlers = createMemo(() => createRuntimeHandlers(props.app, store() ?? null));
  const revision = createMemo(() => snapshot().revision ?? null);
  return (
    <OpenSceneContext.Provider value={{ client, app: props.app, snapshot, revision }}>
      <JSONUIProvider
        registry={props.app.registry as ComponentRegistry}
        store={store()}
        handlers={handlers()}
        directives={[...openSceneDirectives]}
      >
        {props.children}
      </JSONUIProvider>
    </OpenSceneContext.Provider>
  );
}

export { useOpenScene, type OpenSceneContextValue } from "./context.js";
function removePrivateNodeId(element: UIElement): UIElement {
  const props = { ...(element.props as Record<string, unknown>) };
  delete props.__opensceneNodeId;
  return { ...element, props };
}

function createIdentityRegistry(
  registry: Record<string, unknown>,
  getState: () => Record<string, unknown>,
): ComponentRegistry {
  const result: ComponentRegistry = {};
  for (const [type, value] of Object.entries(registry)) {
    const renderer = value as Component<ComponentRenderProps>;
    result[type] = (renderProps: ComponentRenderProps) => {
      const elementProps = renderProps.element.props as Record<string, unknown>;
      const privateId = elementProps.__opensceneNodeId;
      const nodeId = typeof privateId === "string" ? privateId : null;
      const cleanElement = removePrivateNodeId(renderProps.element);
      const evaluatedProps = createMemo(() => {
        const state = getState();
        const resolved = evaluateDynamicValue(cleanElement.props, state) as Record<string, unknown>;
        console.log(`[OpenScene Solid] Component "${type}" (#${nodeId}) evaluated props:`, {
          raw: cleanElement.props,
          evaluated: resolved,
          state,
        });
        return resolved;
      });
      const cleanProps = {
        ...renderProps,
        get props() {
          return evaluatedProps();
        },
        get element() {
          return {
            ...cleanElement,
            get props() {
              return evaluatedProps();
            },
          };
        },
      } as unknown as ComponentRenderProps;
      const isVisible = createMemo(() => {
        if (cleanElement.visible === undefined || cleanElement.visible === null) return true;
        const evaluated = evaluateDynamicValue(cleanElement.visible, getState());
        const visible = Boolean(evaluated);
        console.log(`[OpenScene Visibility] Component "${type}" (#${nodeId}) visibility changed:`, {
          rawCondition: cleanElement.visible,
          evaluated,
          isVisible: visible,
          state: getState(),
        });
        return visible;
      });
      return (
        <Show when={isVisible()}>
          <OpenSceneNodeProvider nodeId={nodeId ?? ""}>
            <span data-node-id={nodeId ?? undefined} style={{ display: "contents" }}>
              {renderer(cleanProps)}
            </span>
          </OpenSceneNodeProvider>
        </Show>
      );
    };
  }
  return result;
}

interface PreparedSpec {
  root: string | null;
  elements: Record<string, UIElement>;
  state?: Record<string, unknown>;
}

function prepareSpec(document: SceneDocument, app: OpenSceneSolidApp): PreparedSpec {
  const source = document.spec;
  const cleanElements: Record<string, UIElement> = {};
  for (const [nodeId, sourceElement] of Object.entries(source.elements)) {
    const slots = sourceElement.slots;
    if (slots) {
      for (const [slot, references] of Object.entries(slots)) {
        if (references.length > 0) {
          throw new Error(
            `OpenScene Solid renderer does not support named slot "${slot}" on node "${nodeId}"`,
          );
        }
      }
    }
    const element = { ...sourceElement } as UIElement;
    if (slots) delete (element as { slots?: unknown }).slots;
    cleanElements[nodeId] = {
      ...element,
      // Normalize: json-render requires an explicit children array on every
      // element, while the protocol schema allows omitting it for leaves.
      children: sourceElement.children ?? [],
      props: { ...(sourceElement.props as Record<string, unknown>) },
    };
  }
  const cleanSpec: PreparedSpec = {
    root: source.root,
    elements: cleanElements,
    ...(source.state === undefined ? {} : { state: source.state }),
  };
  // json-render validation rejects specs without a root, but a freshly
  // created page has none until the author adds the first node; the Renderer
  // renders nothing in that case. Skip validation (and rendering) for them.
  if (source.root !== null) {
    const validation = app.catalog.validate(cleanSpec);
    if (!validation.success) {
      const issue = validation.error?.issues[0];
      throw new Error(issue?.message ?? "OpenScene Solid catalog validation failed");
    }
  }
  const elements = Object.fromEntries(
    Object.entries(cleanElements).map(([nodeId, element]) => [
      nodeId,
      {
        ...element,
        props: { ...(element.props as Record<string, unknown>), __opensceneNodeId: nodeId },
      },
    ]),
  );
  return { ...cleanSpec, elements };
}

function ErrorSurface(props: { error: unknown }): JSX.Element {
  const message = props.error instanceof Error ? props.error.message : String(props.error);
  return (
    <div role="alert" data-open-scene-error="true">
      {message}
    </div>
  );
}

export function OpenSceneRenderer(): JSX.Element {
  const context = useOpenScene();
  const snapshot = context.snapshot;
  const stateGetter = () => {
    const doc = snapshot().document;
    const docState = (doc?.spec?.state as Record<string, unknown> | undefined) ?? {};
    const storeState = snapshot().runtimeStore?.getSnapshot() ?? {};
    return { ...docState, ...storeState };
  };
  const identityRegistry = createMemo(() =>
    createIdentityRegistry(context.app.registry, stateGetter),
  );
  const prepared = createMemo(() => {
    const document = snapshot().document;
    if (!document) return { spec: null as PreparedSpec | null, error: null as Error | null };
    try {
      return {
        spec: prepareSpec(document as unknown as SceneDocument, context.app),
        error: null as Error | null,
      };
    } catch (error) {
      return {
        spec: null as PreparedSpec | null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  });
  const statusError = createMemo(() => (snapshot().status === "error" ? snapshot().error : null));
  // Solid has no keyed reconciliation, so every document push swaps between
  // two Renderer mounts (even/odd revision) to force a fresh render of the
  // latest JSON. json-render builds its element tree once on mount.
  const renderSlot = createMemo(() => ((snapshot().revision ?? 0) % 2 === 0 ? 0 : 1));
  return (
    <Show when={snapshot().status !== "loading"} fallback={<div data-open-scene-loading="true" />}>
      <Show
        when={!statusError() && !prepared().error}
        fallback={<ErrorSurface error={statusError() ?? prepared().error} />}
      >
        <Show when={prepared().spec}>
          {(spec) => (
            <SelectionCanvas>
              <ErrorBoundary fallback={(error) => <ErrorSurface error={error} />}>
                <Show when={renderSlot() === 0}>
                  <Renderer spec={spec() as unknown as Spec} registry={identityRegistry()} />
                </Show>
                <Show when={renderSlot() === 1}>
                  <Renderer spec={spec() as unknown as Spec} registry={identityRegistry()} />
                </Show>
              </ErrorBoundary>
            </SelectionCanvas>
          )}
        </Show>
      </Show>
    </Show>
  );
}
