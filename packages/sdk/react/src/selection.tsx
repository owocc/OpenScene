import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { SelectionReport } from "@openscene/javascript";
import { useOpenScene } from "./provider.js";

interface Point {
  x: number;
  y: number;
}

interface SelectionBox extends Point {
  width: number;
  height: number;
}

function nodeIdFromTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const node = target.closest("[data-node-id]");
  const id = node?.getAttribute("data-node-id");
  return id || null;
}

function orderedNodeIds(canvas: HTMLElement, box: SelectionBox): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const nodes = canvas.querySelectorAll<HTMLElement>("[data-node-id]");
  const boxRight = box.x + box.width;
  const boxBottom = box.y + box.height;

  for (const node of nodes) {
    const id = node.getAttribute("data-node-id");
    if (!id || seen.has(id)) continue;
    const rect = node.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const left = rect.left - canvasRect.left;
    const top = rect.top - canvasRect.top;
    const right = left + rect.width;
    const bottom = top + rect.height;

    const intersects = !(left > boxRight || right < box.x || top > boxBottom || bottom < box.y);
    if (intersects) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function rectForNode(canvas: HTMLElement, id: string): SelectionBox | null {
  const nodes = [...canvas.querySelectorAll<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)];
  const rects = nodes.flatMap((node) => {
    const rect = node.getBoundingClientRect();
    return [rect, ...[...node.children].map((child) => child.getBoundingClientRect())];
  });

  const visible = rects.filter((rect) => rect.width > 0 && rect.height > 0);
  if (visible.length === 0) return null;

  const left = Math.min(...visible.map((rect) => rect.left));
  const top = Math.min(...visible.map((rect) => rect.top));
  const right = Math.max(...visible.map((rect) => rect.right));
  const bottom = Math.max(...visible.map((rect) => rect.bottom));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function normalizeReport(
  ids: string[],
  primary: string | null,
  source: SelectionReport["source"],
): SelectionReport {
  const unique = [...new Set(ids.filter(Boolean))];
  return {
    elementIds: unique,
    primaryElementId: primary && unique.includes(primary) ? primary : (unique[0] ?? null),
    source,
  };
}

export function SelectionCanvas(props: { children: ReactNode }): React.JSX.Element {
  const context = useOpenScene();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ start: Point; current: Point } | null>(null);
  const [dragged, setDragged] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const geometryRevisionRef = useRef(0);

  const snapshot = context.snapshot;
  const interactionMode = snapshot.interactionMode;

  // Auto-scroll when selected element changes
  useEffect(() => {
    const ids = snapshot.selectedElementIds;
    if (ids.length > 0 && canvasRef.current) {
      const targetId = ids[0];
      const nodes = [
        ...canvasRef.current.querySelectorAll<HTMLElement>(
          `[data-node-id="${CSS.escape(targetId)}"]`,
        ),
      ];
      const targetNode =
        nodes.find(
          (n) => n.getBoundingClientRect().width > 0 && n.getBoundingClientRect().height > 0,
        ) ?? nodes[0];
      if (targetNode && typeof targetNode.scrollIntoView === "function") {
        targetNode.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    }
  }, [snapshot.selectedElementIds]);

  // Scroll & resize listeners
  useEffect(() => {
    const invalidate = () => {
      geometryRevisionRef.current += 1;
    };
    const onScroll = () => {
      invalidate();
      context.client.reportScroll(Math.max(0, window.scrollX), Math.max(0, window.scrollY));
    };

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", invalidate);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", invalidate);
    };
  }, [context.client]);

  // Handle geometry requests from Studio
  useEffect(() => {
    context.client.onGeometryRequest = (elementId) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const nodes = [
          ...canvas.querySelectorAll<HTMLElement>(`[data-node-id="${CSS.escape(elementId)}"]`),
        ];
        const targetNode =
          nodes.find(
            (n) => n.getBoundingClientRect().width > 0 && n.getBoundingClientRect().height > 0,
          ) ?? nodes[0];
        if (targetNode && typeof targetNode.scrollIntoView === "function") {
          targetNode.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        }
        const rect = rectForNode(canvas, elementId);
        return rect ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height } : null;
      }
      return null;
    };

    return () => {
      context.client.onGeometryRequest = null;
    };
  }, [context.client]);

  const emitSelection = useCallback(
    (report: SelectionReport) => {
      const canvas = canvasRef.current;
      const rects = canvas
        ? Object.fromEntries(
            report.elementIds
              .map((id) => {
                const rect = rectForNode(canvas, id);
                return rect
                  ? [id, { left: rect.x, top: rect.y, width: rect.width, height: rect.height }]
                  : null;
              })
              .filter(
                (
                  entry,
                ): entry is [
                  string,
                  { left: number; top: number; width: number; height: number },
                ] => entry != null,
              ),
          )
        : {};
      context.client.reportSelection({ ...report, rects });
    },
    [context.client],
  );

  const updateHover = useCallback(
    (elementId: string | null) => {
      if (hovered === elementId) return;
      setHovered(elementId);
      const canvas = canvasRef.current;
      const rect = elementId && canvas ? rectForNode(canvas, elementId) : null;
      context.client.reportHover(
        elementId,
        rect ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height } : null,
      );
    },
    [context.client, hovered],
  );

  const getPoint = (event: ReactPointerEvent): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionMode !== "select" || !canvasRef.current) return;
    const start = getPoint(event);
    if (typeof canvasRef.current.setPointerCapture === "function") {
      canvasRef.current.setPointerCapture(event.pointerId);
    }
    setDrag({ start, current: start });
    setDragged(false);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionMode === "select") {
      updateHover(nodeIdFromTarget(event.target));
    }
    if (!drag || !canvasRef.current) return;
    const current = getPoint(event);
    if (Math.abs(current.x - drag.start.x) > 4 || Math.abs(current.y - drag.start.y) > 4) {
      setDragged(true);
    }
    setDrag({ start: drag.start, current });
  };

  const handlePointerLeave = () => {
    updateHover(null);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const wasDragged = dragged;
    setDrag(null);

    if (wasDragged) {
      const box: SelectionBox = {
        x: Math.min(drag.start.x, drag.current.x),
        y: Math.min(drag.start.y, drag.current.y),
        width: Math.abs(drag.current.x - drag.start.x),
        height: Math.abs(drag.current.y - drag.start.y),
      };
      const ids = orderedNodeIds(canvas, box);
      emitSelection(normalizeReport([ids[0] ?? ""].filter(Boolean), ids[0] ?? null, "marquee"));
      return;
    }

    if (interactionMode !== "select") return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const id = nodeIdFromTarget(element);
    if (!id) {
      emitSelection({ elementIds: [], primaryElementId: null, source: "click" });
      return;
    }
    emitSelection({ elementIds: [id], primaryElementId: id, source: "click" });
  };

  const overlayBox =
    drag && dragged
      ? ({
          x: Math.min(drag.start.x, drag.current.x),
          y: Math.min(drag.start.y, drag.current.y),
          width: Math.abs(drag.current.x - drag.start.x),
          height: Math.abs(drag.current.y - drag.start.y),
        } satisfies SelectionBox)
      : null;

  return (
    <div
      ref={canvasRef}
      data-open-scene-canvas="true"
      style={{ position: "relative", minHeight: "1px" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      {props.children}
      <div
        data-open-scene-overlay="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 2147483647,
        }}
      >
        {overlayBox ? (
          <div
            data-open-scene-marquee="true"
            style={{
              position: "absolute",
              left: `${overlayBox.x}px`,
              top: `${overlayBox.y}px`,
              width: `${overlayBox.width}px`,
              height: `${overlayBox.height}px`,
              border: "1px dashed #0d8aff",
              background: "rgba(13, 138, 255, .12)",
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
