import React, {
  Component,
  useEffect,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  type OpenSceneClient,
  type OpenSceneClientState,
  installOpenScene,
  pageKeyFromPathname,
  evaluateDynamicValue,
  openSceneDirectives,
} from "@openscene-ai/javascript";
import {
  JSONUIProvider,
  Renderer,
  type ComponentRenderProps,
  type ComponentRegistry,
} from "@json-render/react";
import type { Spec, UIElement } from "@json-render/core";
import type { AppType, SceneDocument } from "@openscene-ai/core";
import type {
  OpenSceneReactActionDefinition,
  OpenSceneReactComponentDefinition,
  OpenSceneReactRuntime,
} from "./catalog.ts";
import { createOpenSceneReactRuntime } from "./catalog.ts";
import { OpenSceneContext, useOpenScene, type OpenSceneContextValue } from "./context.ts";
import { OpenSceneNodeProvider } from "./node.tsx";
import { SelectionCanvas } from "./selection.tsx";

export interface OpenSceneProviderProps {
  client?: OpenSceneClient;
  runtime: OpenSceneReactRuntime;
  children?: ReactNode;
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
  runtime: OpenSceneReactRuntime,
  store: OpenSceneClientState["runtimeStore"],
): Record<string, (params: Record<string, unknown>) => Promise<void>> | undefined {
  if (!store || !runtime.handlers) return undefined;
  const handlerFactory = runtime.handlers as unknown;
  if (typeof handlerFactory !== "function") {
    return runtime.handlers as unknown as Record<
      string,
      (params: Record<string, unknown>) => Promise<void>
    >;
  }

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
export function OpenSceneProvider(props: OpenSceneProviderProps): React.JSX.Element {
  const client = props.client ?? getDefaultClient();
  const [snapshot, setSnapshot] = useState<OpenSceneClientState>(() => client.getSnapshot());

  useEffect(() => {
    return subscribeClient(client, setSnapshot);
  }, [client]);

  const store = snapshot.runtimeStore ?? undefined;
  const handlers = useMemo(
    () => createRuntimeHandlers(props.runtime, store ?? null),
    [props.runtime, store],
  );
  const revision = snapshot.revision ?? null;

  const value = useMemo<OpenSceneContextValue>(
    () => ({
      client,
      runtime: props.runtime,
      snapshot,
      revision,
    }),
    [client, props.runtime, snapshot, revision],
  );

  return (
    <OpenSceneContext.Provider value={value}>
      <JSONUIProvider
        registry={props.runtime.registry as ComponentRegistry}
        store={store}
        handlers={handlers}
        directives={[...openSceneDirectives]}
      >
        {props.children}
      </JSONUIProvider>
    </OpenSceneContext.Provider>
  );
}

export { useOpenScene, type OpenSceneContextValue } from "./context.ts";

function removePrivateNodeId(element: UIElement): UIElement {
  const nextProps = { ...(element.props as Record<string, unknown>) };
  delete nextProps.__opensceneNodeId;
  return { ...element, props: nextProps };
}

function createIdentityRegistry(
  registry: Record<string, unknown>,
  getState: () => Record<string, unknown>,
): ComponentRegistry {
  const result: ComponentRegistry = {};

  for (const [type, value] of Object.entries(registry)) {
    const ComponentRenderer = value as React.ComponentType<ComponentRenderProps>;

    result[type] = function OpenSceneComponentWrapper(renderProps: ComponentRenderProps) {
      const elementProps = (renderProps.element?.props ?? {}) as Record<string, unknown>;
      const privateId = elementProps.__opensceneNodeId;
      const nodeId = typeof privateId === "string" ? privateId : null;
      const cleanElement = removePrivateNodeId(renderProps.element);

      const state = getState();
      const evaluatedProps = evaluateDynamicValue(cleanElement.props, state) as Record<
        string,
        unknown
      >;

      const isVisible =
        cleanElement.visible === undefined || cleanElement.visible === null
          ? true
          : Boolean(evaluateDynamicValue(cleanElement.visible, state));

      if (!isVisible) {
        return null;
      }

      const cleanProps: ComponentRenderProps = {
        ...renderProps,
        element: {
          ...cleanElement,
          props: evaluatedProps,
        },
      };

      return (
        <OpenSceneNodeProvider nodeId={nodeId ?? ""}>
          <span data-node-id={nodeId ?? undefined} style={{ display: "contents" }}>
            <ComponentRenderer {...cleanProps} />
          </span>
        </OpenSceneNodeProvider>
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

function prepareSpec(document: SceneDocument, runtime: OpenSceneReactRuntime): PreparedSpec {
  const source = document.spec;
  const cleanElements: Record<string, UIElement> = {};

  for (const [nodeId, sourceElement] of Object.entries(source.elements)) {
    const slots = sourceElement.slots;
    if (slots) {
      for (const [slot, references] of Object.entries(slots)) {
        if (references.length > 0) {
          throw new Error(
            `OpenScene React renderer does not support named slot "${slot}" on node "${nodeId}"`,
          );
        }
      }
    }
    const element = { ...sourceElement } as UIElement;
    if (slots) delete (element as { slots?: unknown }).slots;
    cleanElements[nodeId] = {
      ...element,
      children: sourceElement.children ?? [],
      props: { ...(sourceElement.props as Record<string, unknown>) },
    };
  }

  const cleanSpec: PreparedSpec = {
    root: source.root,
    elements: cleanElements,
    ...(source.state === undefined ? {} : { state: source.state }),
  };

  if (source.root !== null) {
    const validation = runtime.catalog.validate(cleanSpec);
    if (!validation.success) {
      const issue = validation.error?.issues[0];
      throw new Error(issue?.message ?? "OpenScene React catalog validation failed");
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

function ErrorSurface(props: { error: unknown }): React.JSX.Element {
  const message = props.error instanceof Error ? props.error.message : String(props.error);
  return (
    <div role="alert" data-open-scene-error="true">
      {message}
    </div>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class OpenSceneErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[OpenScene React] Uncaught rendering error:", error, errorInfo);
  }

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error);
      }
      return <ErrorSurface error={this.state.error} />;
    }
    return this.props.children;
  }
}

export function OpenSceneRenderer(): React.JSX.Element {
  const context = useOpenScene();
  const snapshot = context.snapshot;

  const stateGetter = () => {
    const doc = snapshot.document;
    const docState = (doc?.spec?.state as Record<string, unknown> | undefined) ?? {};
    const storeState = snapshot.runtimeStore?.getSnapshot() ?? {};
    return { ...docState, ...storeState };
  };

  const identityRegistry = useMemo(
    () => createIdentityRegistry(context.runtime.registry, stateGetter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.runtime.registry, snapshot.document, snapshot.runtimeStore],
  );

  const prepared = useMemo(() => {
    const document = snapshot.document;
    if (!document) return { spec: null, error: null };
    try {
      return {
        spec: prepareSpec(document as unknown as SceneDocument, context.runtime),
        error: null,
      };
    } catch (error) {
      return {
        spec: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }, [snapshot.document, context.runtime]);

  const statusError = snapshot.status === "error" ? snapshot.error : null;

  if (snapshot.status === "loading") {
    return <div data-open-scene-loading="true" />;
  }

  const error = statusError ?? prepared.error;
  if (error) {
    return <ErrorSurface error={error} />;
  }

  if (!prepared.spec) {
    return <></>;
  }

  return (
    <SelectionCanvas>
      <OpenSceneErrorBoundary>
        <Renderer
          key={snapshot.revision ?? 0}
          spec={prepared.spec as unknown as Spec}
          registry={identityRegistry}
        />
      </OpenSceneErrorBoundary>
    </SelectionCanvas>
  );
}
export interface OpenSceneProps {
  baseUrl: string;
  pageKey?: string;
  appType?: AppType;
  components?:
    | OpenSceneReactComponentDefinition<any>[]
    | Record<string, OpenSceneReactComponentDefinition<any>>;
  actions?: OpenSceneReactActionDefinition[] | Record<string, OpenSceneReactActionDefinition>;
  children?: ReactNode;
}

/** Query-driven OpenScene runtime: static page JSON in production, Studio bridge in editor mode. */
export function OpenScene(props: OpenSceneProps): React.JSX.Element {
  const runtime = useMemo(
    () =>
      createOpenSceneReactRuntime({
        appType: props.appType,
        components: props.components,
        actions: props.actions,
      }),
    [props.appType, props.components, props.actions],
  );
  const pageKey =
    props.pageKey ??
    (typeof window === "undefined" ? "home" : pageKeyFromPathname(window.location.pathname));
  const client = useMemo(
    () => installOpenScene({ baseUrl: props.baseUrl, pageKey, appType: runtime.appType }),
    [props.baseUrl, pageKey, runtime.appType],
  );

  useEffect(() => () => client.destroy(), [client]);

  return (
    <OpenSceneProvider client={client} runtime={runtime}>
      {props.children ?? <OpenSceneRenderer />}
    </OpenSceneProvider>
  );
}
