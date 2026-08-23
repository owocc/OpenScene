import { useEffect, useMemo, useRef, useState } from "react";

import {
  RendererPortMessageSchema,
  RendererWindowMessageSchema,
  StudioPortMessageSchema,
  createBridgeEnvelope,
  withEditorConnection,
} from "@openscene/protocol";
import type { AppType } from "@openscene/constants";
import type { ElementRect } from "@openscene/protocol";
import type { CanvasRendererProps } from "../types";
export function isRendererReadyForSession(value: unknown, sessionId: string, appType: AppType) {
  const parsed = RendererWindowMessageSchema.safeParse(value);
  return (
    parsed.success && parsed.data.sessionId === sessionId && parsed.data.payload.appType === appType
  );
}

export function WebIframeRenderer({
  url,
  allowedOrigin,
  appType,
  document,
  revision,
  selectedNodeIds,
  interactionMode,
  onSelectionChange,
  onHoverElement,
  onError,
}: CanvasRendererProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [connected, setConnected] = useState(false);
  const portRef = useRef<MessagePort | null>(null);
  // Element geometry reported by the renderer (relative to the frame viewport);
  // drawn on a Studio-owned overlay so the iframe content stays untouched.
  const [hoverRect, setHoverRect] = useState<ElementRect | null>(null);
  const [selectionRects, setSelectionRects] = useState<Record<string, ElementRect>>({});
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const callbacksRef = useRef({ onSelectionChange, onHoverElement, onError });
  const hasLoadedRef = useRef(false);
  const resettingRef = useRef(false);
  // Tracks the last revision pushed to the renderer so every document change
  // is forwarded deterministically at render time (no effect scheduling).
  const sentRevisionRef = useRef<number | null>(null);
  const editorUrl = useMemo(
    () => withEditorConnection(url, { studioOrigin: window.location.origin, sessionId }),
    [url, sessionId],
  );

  if (connected && portRef.current && sentRevisionRef.current !== revision) {
    sentRevisionRef.current = revision;
    const message = createBridgeEnvelope(sessionIdRef.current, "DOCUMENT_SET", {
      document,
      revision,
    });
    const parsed = StudioPortMessageSchema.safeParse(message);
    if (parsed.success) portRef.current.postMessage(parsed.data);
  }

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const sessionId = sessionIdRef.current;
    const receiveReady = (event: MessageEvent<unknown>) => {
      if (event.source !== frame.contentWindow || event.origin !== allowedOrigin) return;
      if (!isRendererReadyForSession(event.data, sessionId, appType)) return;
      const parsed = RendererWindowMessageSchema.safeParse(event.data);
      if (!parsed.success) return;

      const channel = new MessageChannel();
      channel.port1.onmessage = (portEvent: MessageEvent<unknown>) => {
        const message = RendererPortMessageSchema.safeParse(portEvent.data);
        if (!message.success || message.data.sessionId !== sessionId) return;
        if (message.data.type === "SELECTION_CHANGED") {
          callbacksRef.current.onSelectionChange(
            message.data.payload.elementIds,
            message.data.payload.primaryElementId,
          );
          setSelectionRects(message.data.payload.rects);
        } else if (message.data.type === "ELEMENT_HOVER") {
          setHoverRect(message.data.payload.rect);
          callbacksRef.current.onHoverElement?.(message.data.payload.elementId);
        } else if (message.data.type === "ELEMENT_GEOMETRY") {
          const { elementId, rect } = message.data.payload as {
            elementId: string;
            rect: ElementRect;
          };
          setSelectionRects((prev) => ({ ...prev, [elementId]: rect }));
        } else if (message.data.type === "RENDERER_ERROR") {
          callbacksRef.current.onError?.(message.data.payload.message);
        }
      };
      channel.port1.start();
      portRef.current?.close();
      portRef.current = channel.port1;
      frame.contentWindow?.postMessage(
        createBridgeEnvelope(sessionId, "STUDIO_CONNECT", undefined),
        { targetOrigin: allowedOrigin, transfer: [channel.port2] },
      );
      setConnected(true);
    };
    window.addEventListener("message", receiveReady);
    return () => {
      window.removeEventListener("message", receiveReady);
      portRef.current?.close();
      portRef.current = null;
      setConnected(false);
    };
  }, [allowedOrigin, appType, sessionId]);

  useEffect(() => {
    if (!connected || !portRef.current) return;
    const message = createBridgeEnvelope(sessionIdRef.current, "EDITOR_STATE_SET", {
      interactionMode,
      selectedElementIds: selectedNodeIds,
    });
    const parsed = StudioPortMessageSchema.safeParse(message);
    if (parsed.success) portRef.current.postMessage(parsed.data);
    // Tree selection: ask the renderer for each selected element's geometry so
    // the overlay can draw its outline even without an iframe click. Reset
    // first so stale outlines from a previous selection never linger.
    setSelectionRects({});
    for (const id of selectedNodeIds) {
      const request = createBridgeEnvelope(sessionIdRef.current, "ELEMENT_GEOMETRY_REQUEST", {
        elementId: id,
      });
      const valid = StudioPortMessageSchema.safeParse(request);
      if (valid.success) portRef.current.postMessage(valid.data);
    }
  }, [connected, interactionMode, selectedNodeIds]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <iframe
        ref={frameRef}
        title="Target App preview"
        src={editorUrl}
        className="h-full w-full border-0 bg-background"
        referrerPolicy="no-referrer"
        onLoad={() => {
          if (!hasLoadedRef.current) {
            hasLoadedRef.current = true;
            return;
          }
          if (resettingRef.current) {
            resettingRef.current = false;
            return;
          }
          portRef.current?.close();
          portRef.current = null;
          setConnected(false);
          resettingRef.current = true;
          setSessionId(crypto.randomUUID());
        }}
      />
      {/* Studio-owned overlay: draws hover/selection outlines from geometry
        reported by the iframe, keeping the preview DOM untouched. */}
      <div
        id="openscene-selection-overlay"
        data-open-scene-overlay="true"
        className="pointer-events-none absolute inset-0 z-50"
        aria-hidden="true"
      >
        {interactionMode === "select" && hoverRect && (
          <div
            id="openscene-hover-box"
            data-open-scene-hover="true"
            className="absolute border border-dashed border-sky-500/90 bg-sky-500/5"
            style={{
              left: `${hoverRect.left}px`,
              top: `${hoverRect.top}px`,
              width: `${hoverRect.width}px`,
              height: `${hoverRect.height}px`,
            }}
          />
        )}
        {Object.entries(selectionRects).map(([id, rect]) => (
          <div
            key={id}
            id={`openscene-outline-${id}`}
            data-open-scene-outline={id}
            className="absolute border-2 border-sky-600"
            style={{
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
