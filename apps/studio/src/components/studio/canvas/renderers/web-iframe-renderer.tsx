import { useEffect, useRef, useState } from "react";

import type { CanvasRendererProps } from "../types";

const BRIDGE_PROTOCOL = "cms-preview";
const BRIDGE_VERSION = 2;

type BridgeEnvelope = {
  protocol: typeof BRIDGE_PROTOCOL;
  version: number;
  instanceId: string;
  type: string;
  payload?: unknown;
};

type PreviewPortMessage = {
  type: string;
  [key: string]: unknown;
};

function envelope(instanceId: string, type: string, payload: unknown): BridgeEnvelope {
  return {
    protocol: BRIDGE_PROTOCOL,
    version: BRIDGE_VERSION,
    instanceId,
    type,
    payload,
  };
}

function isEnvelope(value: unknown): value is BridgeEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.protocol === BRIDGE_PROTOCOL &&
    candidate.version === BRIDGE_VERSION &&
    typeof candidate.instanceId === "string" &&
    typeof candidate.type === "string"
  );
}

function isPortMessage(value: unknown): value is PreviewPortMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function payloadRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Default Web Iframe Canvas Renderer.
 * Connects to the target App iframe over Preview Bridge protocol,
 * streaming document state, locale, and selection in real time.
 */
export function WebIframeRenderer({
  url,
  allowedOrigin,
  identity,
  document,
  locale,
  revision,
  selectedId,
  interactionMode,
  onSelect,
}: CanvasRendererProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const portRef = useRef<MessagePort | null>(null);
  const instanceIdRef = useRef<string>(crypto.randomUUID());
  const latestRef = useRef({ document, locale, revision });
  const onSelectRef = useRef(onSelect);
  const interactionModeRef = useRef(interactionMode);
  const [, setStatus] = useState<"waiting" | "connected" | "error">("waiting");

  useEffect(() => {
    latestRef.current = { document, locale, revision };
  }, [document, locale, revision]);

  useEffect(() => {
    onSelectRef.current = onSelect;
    interactionModeRef.current = interactionMode;
  }, [interactionMode, onSelect]);

  const send = (type: string, payload: Record<string, unknown>) => {
    portRef.current?.postMessage({ type, ...payload });
  };

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const handleWindowMessage = (event: MessageEvent<unknown>) => {
      if (
        event.source !== frame.contentWindow ||
        event.origin !== allowedOrigin ||
        !isEnvelope(event.data) ||
        event.data.type !== "BRIDGE_READY"
      ) {
        return;
      }

      const ready = payloadRecord(event.data.payload);
      const readyIdentity = payloadRecord(ready?.identity);
      if (
        readyIdentity &&
        ((typeof readyIdentity.id === "string" && readyIdentity.id !== identity.resourceId) ||
          (readyIdentity.type === "model" && identity.resourceKind !== "template") ||
          (readyIdentity.type === "page" && identity.resourceKind !== "page"))
      ) {
        setStatus("error");
        return;
      }

      const channel = new MessageChannel();
      channel.port1.onmessage = (portEvent: MessageEvent<unknown>) => {
        if (!isPortMessage(portEvent.data)) return;
        if (portEvent.data.type === "NODE_CLICK" || portEvent.data.type === "SELECT_NODE") {
          const elementId = portEvent.data.elementId ?? portEvent.data.nodeId;
          if (typeof elementId === "string") onSelectRef.current(elementId);
        }
        if (portEvent.data.type === "CANVAS_ERROR") {
          setStatus("error");
        }
      };
      channel.port1.start();
      portRef.current?.close();
      portRef.current = channel.port1;
      instanceIdRef.current = event.data.instanceId;

      frame.contentWindow?.postMessage(
        envelope(instanceIdRef.current, "BRIDGE_INIT", {
          context: {
            locale: latestRef.current.locale,
            resourceId: identity.resourceId,
            resourceType: identity.resourceKind,
          },
          document: latestRef.current.document,
          interactionMode: interactionModeRef.current,
          permissions: { allowMutations: false, allowNavigation: false },
          revision: latestRef.current.revision,
        }),
        { targetOrigin: allowedOrigin, transfer: [channel.port2] },
      );
      setStatus("connected");
    };

    window.addEventListener("message", handleWindowMessage);
    return () => {
      window.removeEventListener("message", handleWindowMessage);
      portRef.current?.close();
      portRef.current = null;
    };
  }, [allowedOrigin, identity, url]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      send("SPEC_REPLACE", { document, revision });
      send("SET_LOCALE", { locale });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [document, locale, revision]);

  useEffect(() => {
    send("SET_INTERACTION_MODE", { mode: interactionMode });
  }, [interactionMode]);

  useEffect(() => {
    send("SELECT_NODE", { elementId: selectedId || null });
  }, [selectedId]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <iframe
        ref={frameRef}
        title="Target App preview"
        src={url}
        className="h-full w-full border-0 bg-background"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
