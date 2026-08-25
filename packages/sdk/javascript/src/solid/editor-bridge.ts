import { createSignal, onCleanup, onMount, type Accessor } from "solid-js";
import {
  createBridgeEnvelope,
  getEditorConnection,
  isBridgeEnvelope,
  type SceneDocumentSnapshot,
} from "@openscene-ai/protocol";
import type { SceneDocument } from "./types.js";

export interface SceneEditorBridge {
  enabled: boolean;
  selectedElementId: Accessor<string | null>;
  selectElement: (elementId: string) => void;
}

function toSnapshot(document: SceneDocument): SceneDocumentSnapshot {
  return {
    root: document.spec.root,
    elements: Object.fromEntries(
      Object.entries(document.spec.elements).map(([id, element]) => [
        id,
        {
          id,
          type: element.type,
          props: element.props ?? {},
          children: element.children ?? [],
          slots: element.slots ?? {},
        },
      ]),
    ),
    state: document.spec.state ?? {},
  };
}

export function useSceneEditorBridge(
  document: SceneDocument | null | undefined,
): SceneEditorBridge {
  const [selectedElementId, setSelectedElementId] = createSignal<string | null>(null);
  let port: MessagePort | null = null;
  const connection =
    typeof window === "undefined" ? null : getEditorConnection(window.location.search);

  const selectElement = (elementId: string) => {
    if (!connection || !document) return;
    const node = toSnapshot(document).elements[elementId];
    if (!node) return;
    setSelectedElementId(elementId);
    port?.postMessage(createBridgeEnvelope(connection.sessionId, "SCENE_NODE_SELECTED", node));
  };

  onMount(() => {
    if (!connection || !document || window.parent === window) return;
    const announce = () => {
      window.parent.postMessage(
        createBridgeEnvelope(connection.sessionId, "SCENE_READY", undefined),
        connection.studioOrigin,
      );
    };
    const connect = (event: MessageEvent<unknown>) => {
      if (
        event.source !== window.parent ||
        event.origin !== connection.studioOrigin ||
        !isBridgeEnvelope(event.data) ||
        event.data.sessionId !== connection.sessionId ||
        event.data.type !== "SCENE_CONNECT" ||
        !event.ports[0]
      )
        return;
      port?.close();
      port = event.ports[0];
      port.onmessage = (portEvent: MessageEvent<unknown>) => {
        if (
          !isBridgeEnvelope(portEvent.data) ||
          portEvent.data.sessionId !== connection.sessionId ||
          portEvent.data.type !== "SCENE_SELECT"
        )
          return;
        const payload = portEvent.data.payload;
        if (
          typeof payload === "object" &&
          payload !== null &&
          "elementId" in payload &&
          typeof payload.elementId === "string"
        )
          setSelectedElementId(payload.elementId);
      };
      port.start();
      port.postMessage(
        createBridgeEnvelope(connection.sessionId, "SCENE_DOCUMENT", toSnapshot(document)),
      );
    };
    window.addEventListener("message", connect);
    announce();
    return () => {
      window.removeEventListener("message", connect);
      port?.close();
      port = null;
    };
  });

  onCleanup(() => port?.close());
  return { enabled: connection !== null, selectedElementId, selectElement };
}
