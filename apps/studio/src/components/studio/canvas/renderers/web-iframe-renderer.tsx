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
  viewportSize,
  onSelectionChange,
  onHoverElement,
  onGeometryChange,
  onFrameDrop,
  onError,
}: CanvasRendererProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [connected, setConnected] = useState(false);
  const portRef = useRef<MessagePort | null>(null);
  // Element geometry reported by the renderer (relative to the frame viewport);
  // drawn on a Studio-owned overlay so the iframe content stays untouched.
  const [hoverRect, setHoverRect] = useState<ElementRect | null>(null);
  const [selectionRects, setSelectionRects] = useState<Record<string, ElementRect>>({});
  // Current scroll offset of the iframe document; outlines render at
  // content coordinates minus this offset so they follow scrolling.
  const [frameScroll, setFrameScroll] = useState({ left: 0, top: 0 });
  const frameScrollRef = useRef(frameScroll);
  frameScrollRef.current = frameScroll;
  // Component-card drag in progress: shows a transparent accept layer over
  // the frame so a drop lands here (same-origin) instead of the cross-origin
  // iframe content, which never surfaces drop events to the parent.
  const [acceptingDrop, setAcceptingDrop] = useState(false);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const callbacksRef = useRef({
    onSelectionChange,
    onHoverElement,
    onGeometryChange,
    onFrameDrop,
    onError,
  });
  // Keep the ref pointing at the latest props: the initial capture would
  // otherwise freeze stale closures (e.g. addComponent over an old document).
  useEffect(() => {
    callbacksRef.current = {
      onSelectionChange,
      onHoverElement,
      onGeometryChange,
      onFrameDrop,
      onError,
    };
  }, [onSelectionChange, onHoverElement, onGeometryChange, onFrameDrop, onError]);
  const hasLoadedRef = useRef(false);
  const resettingRef = useRef(false);
  // Tracks the last revision pushed to the renderer so every document change
  const sentRevisionRef = useRef<number | null>(null);
  const documentRef = useRef(document);
  documentRef.current = document;
  const revisionRef = useRef(revision);
  revisionRef.current = revision;
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
          // Hover rect is viewport-relative; shift into content coordinates
          // using the last known scroll so it tracks the frame.
          const rect = message.data.payload.rect;
          setHoverRect(
            rect
              ? {
                  left: rect.left + frameScrollRef.current.left,
                  top: rect.top + frameScrollRef.current.top,
                  width: rect.width,
                  height: rect.height,
                }
              : null,
          );
          callbacksRef.current.onHoverElement?.(message.data.payload.elementId);
        } else if (message.data.type === "ELEMENT_GEOMETRY") {
          const { elementId, rect, scrollLeft, scrollTop } = message.data.payload as {
            elementId: string;
            rect: ElementRect;
            scrollLeft: number;
            scrollTop: number;
          };
          // Translate viewport rect into content coordinates so the outline
          // stays glued to the element as the frame scrolls.
          const content: ElementRect = {
            left: rect.left + scrollLeft,
            top: rect.top + scrollTop,
            width: rect.width,
            height: rect.height,
          };
          setSelectionRects((prev) => ({ ...prev, [elementId]: content }));
          callbacksRef.current.onGeometryChange?.(elementId, rect, scrollLeft, scrollTop);
        } else if (message.data.type === "FRAME_SCROLL") {
          setFrameScroll({
            left: message.data.payload.scrollLeft,
            top: message.data.payload.scrollTop,
          });
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
      const initMessage = createBridgeEnvelope(sessionId, "DOCUMENT_SET", {
        document: documentRef.current,
        revision: revisionRef.current,
      });
      const parsedDoc = StudioPortMessageSchema.safeParse(initMessage);
      if (parsedDoc.success) {
        channel.port1.postMessage(parsedDoc.data);
        sentRevisionRef.current = revisionRef.current;
      }
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
    const showDropLayer = () => {
      const pending = (window as unknown as Record<string, string | null>)
        .__opensceneDraggingComponent;
      if (pending) setAcceptingDrop(true);
    };
    const hideDropLayer = () => setAcceptingDrop(false);
    window.document.addEventListener("dragstart", showDropLayer);
    window.document.addEventListener("dragend", hideDropLayer);
    window.document.addEventListener("drop", hideDropLayer);
    return () => {
      window.document.removeEventListener("dragstart", showDropLayer);
      window.document.removeEventListener("dragend", hideDropLayer);
      window.document.removeEventListener("drop", hideDropLayer);
    };
  }, []);

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
  }, [connected, interactionMode, selectedNodeIds, viewportSize?.width, viewportSize?.height]);

  // Re-request geometry when the frame resizes (canvas size change re-lays out
  // the iframe content, shifting element positions).
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !connected || !portRef.current) return undefined;
    const requestGeometry = () => {
      setSelectionRects({});
      for (const id of selectedNodeIds) {
        const request = createBridgeEnvelope(sessionIdRef.current, "ELEMENT_GEOMETRY_REQUEST", {
          elementId: id,
        });
        const valid = StudioPortMessageSchema.safeParse(request);
        if (valid.success) portRef.current?.postMessage(valid.data);
      }
    };
    const observer = new ResizeObserver(requestGeometry);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [connected, selectedNodeIds]);

  return (
    <div className="relative h-full w-full">
      <div className="relative  h-full w-full overflow-hidden">
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
      </div>
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
              left: `${hoverRect.left - frameScroll.left}px`,
              top: `${hoverRect.top - frameScroll.top}px`,
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
              left: `${rect.left - frameScroll.left}px`,
              top: `${rect.top - frameScroll.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
            }}
          >
            {/* Corner handles (Figma-style resize grips) */}
            <span className="absolute -left-1 -top-1 size-2 border-2 border-sky-600 bg-white" />
            <span className="absolute -right-1 -top-1 size-2 border-2 border-sky-600 bg-white" />
            <span className="absolute -left-1 -bottom-1 size-2 border-2 border-sky-600 bg-white" />
            <span className="absolute -right-1 -bottom-1 size-2 border-2 border-sky-600 bg-white" />
            {/* Element name label above the frame */}
            <span className="absolute left-0 -translate-y-full -mt-1.5 max-w-48 truncate rounded-sm bg-sky-600 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
              {document.spec.elements[id]?.type ?? id}
            </span>
          </div>
        ))}
      </div>
      {/* Component-card drop accept layer: covers the frame only while a
          component drag is active, so drops land here instead of the
          cross-origin iframe. Placement lives in Studio (current selection). */}
      {acceptingDrop && (
        <div
          id="openscene-drop-layer"
          data-open-scene-drop-layer="true"
          className="absolute inset-0 z-40"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            setAcceptingDrop(false);
            onFrameDrop?.();
          }}
        />
      )}
    </div>
  );
}
