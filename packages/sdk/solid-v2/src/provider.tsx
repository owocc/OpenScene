import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { OpenSceneClient, OpenSceneClientState } from "@openscene-ai/javascript";
import type { AppManifest, SceneDocument } from "@openscene-ai/protocol";
import {
  createBridgeEnvelope,
  getEditorConnection,
  isBridgeEnvelope,
} from "@openscene-ai/protocol";
import type { OpenSceneSolidApp } from "./catalog.ts";
import { OpenSceneContext } from "./context.ts";
import { RuntimeProvider } from "./runtime-ctx.tsx";
import { DocumentRenderer } from "./doc-renderer.tsx";

export interface OpenSceneProviderProps {
  app: OpenSceneSolidApp;
  client: OpenSceneClient;
  children?: JSX.Element;
}

export function OpenSceneProvider(props: OpenSceneProviderProps): JSX.Element {
  const [snapshot, setSnapshot] = createSignal<OpenSceneClientState>(props.client.getSnapshot());

  // Subscribe to client state changes.
  createEffect(() => {
    const { client } = props;
    const unsubscribe = client.subscribe(() => setSnapshot(client.getSnapshot()));
    onCleanup(unsubscribe);
  });

  const document = createMemo<SceneDocument | null>(
    () => snapshot().document as SceneDocument | null,
  );

  const initialState = createMemo(() => {
    const doc = document();
    return (doc?.spec.state as Record<string, unknown> | undefined) ?? {};
  });

  return (
    <Show when={document()}>
      {(doc: () => SceneDocument) => (
        <OpenSceneContext
          value={{
            client: props.client,
            app: props.app,
            snapshot,
            revision: () => snapshot().revision,
          }}
        >
          <RuntimeProvider app={props.app} initialState={initialState()}>
            <OpenSceneRendererBridge client={props.client} app={props.app} document={doc()} />
            <DocumentRenderer document={doc()} />
            {props.children}
          </RuntimeProvider>
        </OpenSceneContext>
      )}
    </Show>
  );
}

// ---------------------------------------------------------------------------
// Internal bridge component: reports rendered, handles Studio connection.
// ---------------------------------------------------------------------------

interface BridgeProps {
  client: OpenSceneClient;
  app: OpenSceneSolidApp;
  document: SceneDocument;
}

function OpenSceneRendererBridge(props: BridgeProps): JSX.Element {
  // Report rendered on every document change.
  createEffect(() => {
    void props.document;
    props.client.reportRendered();
  });

  return <></>;
}

// ---------------------------------------------------------------------------
// Standalone renderer (no Studio client needed – uses DEV bridge directly).
// ---------------------------------------------------------------------------

export interface OpenSceneStandaloneProps {
  app: OpenSceneSolidApp;
  /** Initial page document for static/dev use. */
  document?: SceneDocument;
  children?: JSX.Element;
}

export function OpenSceneStandalone(props: OpenSceneStandaloneProps): JSX.Element {
  const doc = createMemo(() => props.document ?? null);
  const initialState = createMemo(
    () => (doc()?.spec.state as Record<string, unknown> | undefined) ?? {},
  );

  return (
    <Show when={doc()}>
      {(d: () => SceneDocument) => (
        <RuntimeProvider app={props.app} initialState={initialState()}>
          <DocumentRenderer document={d()} />
          {props.children}
        </RuntimeProvider>
      )}
    </Show>
  );
}

// ---------------------------------------------------------------------------
// Dev-mode manifest push utility.
// After the Studio port is established, push the app manifest so Studio can
// populate the property editor without a server upload (local dev loop).
// Call once at app startup when running inside the Studio iframe.
// ---------------------------------------------------------------------------

export function installDevManifest(manifest: AppManifest): () => void {
  const connection =
    typeof window === "undefined" ? null : getEditorConnection(window.location.search);
  if (!connection || window.parent === window) return () => {};

  let port: MessagePort | null = null;

  const pushManifest = () => {
    port?.postMessage(createBridgeEnvelope(connection.sessionId, "DEV_MANIFEST", { manifest }));
  };

  const onWindowMessage = (event: MessageEvent<unknown>) => {
    if (!isBridgeEnvelope(event.data)) return;
    if (event.data["type"] !== "STUDIO_CONNECT") return;
    const transferred = (event as MessageEvent & { ports: readonly MessagePort[] }).ports;
    if (!transferred[0]) return;
    port = transferred[0];
    port.start();
    pushManifest();
  };

  window.addEventListener("message", onWindowMessage);
  return () => window.removeEventListener("message", onWindowMessage);
}
