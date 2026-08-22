import { useEffect, useMemo, useRef, useState } from "react";

import {
  createBridgeEnvelope,
  isBridgeEnvelope,
  withEditorConnection,
  type SceneDocumentSnapshot,
} from "@openscene/protocol";

import type { CanvasRendererProps } from "../types";

export function WebIframeRenderer({
  url,
  allowedOrigin,
  selectedId,
  onSelect,
  onRemoteDocument,
}: CanvasRendererProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const portRef = useRef<MessagePort | null>(null);
  const sessionIdRef = useRef(crypto.randomUUID());
  const onSelectRef = useRef(onSelect);
  const onRemoteDocumentRef = useRef(onRemoteDocument);
  const [connected, setConnected] = useState(false);
  const editorUrl = useMemo(
    () =>
      withEditorConnection(url, {
        studioOrigin: window.location.origin,
        sessionId: sessionIdRef.current,
      }),
    [url],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
    onRemoteDocumentRef.current = onRemoteDocument;
  }, [onRemoteDocument, onSelect]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const receiveReady = (event: MessageEvent<unknown>) => {
      if (
        event.source !== frame.contentWindow ||
        event.origin !== allowedOrigin ||
        !isBridgeEnvelope(event.data) ||
        event.data.sessionId !== sessionIdRef.current ||
        event.data.type !== "SCENE_READY"
      ) return;
      const channel = new MessageChannel();
      channel.port1.onmessage = (portEvent: MessageEvent<unknown>) => {
        if (!isBridgeEnvelope(portEvent.data) || portEvent.data.sessionId !== sessionIdRef.current) return;
        if (portEvent.data.type === "SCENE_DOCUMENT") onRemoteDocumentRef.current?.(portEvent.data.payload as SceneDocumentSnapshot);
        if (portEvent.data.type === "SCENE_NODE_SELECTED") onSelectRef.current((portEvent.data.payload as { id: string }).id);
      };
      channel.port1.start();
      portRef.current?.close();
      portRef.current = channel.port1;
      frame.contentWindow?.postMessage(
        createBridgeEnvelope(sessionIdRef.current, "SCENE_CONNECT", undefined),
        { targetOrigin: allowedOrigin, transfer: [channel.port2] },
      );
      setConnected(true);
    };
    window.addEventListener("message", receiveReady);
    return () => {
      window.removeEventListener("message", receiveReady);
      portRef.current?.close();
      portRef.current = null;
    };
  }, [allowedOrigin]);

  useEffect(() => {
    if (!connected) return;
    portRef.current?.postMessage(createBridgeEnvelope(sessionIdRef.current, "SCENE_SELECT", { elementId: selectedId || null }));
  }, [connected, selectedId]);

  return <iframe ref={frameRef} title="Target App preview" src={editorUrl} className="h-full w-full border-0 bg-background" referrerPolicy="no-referrer" />;
}
