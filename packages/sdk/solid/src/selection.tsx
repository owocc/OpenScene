import { createEffect, createSignal, For, Show, onCleanup, type JSX } from "solid-js";
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
  for (const node of nodes) {
    const id = node.dataset.nodeId;
    if (!id || seen.has(id)) continue;
    const visual = rectForNode(canvas, id, () => 0);
    if (!visual) continue;
    const right = visual.x + visual.width;
    const bottom = visual.y + visual.height;
    const boxRight = box.x + box.width;
    const boxBottom = box.y + box.height;
    if (right >= box.x && visual.x <= boxRight && bottom >= box.y && visual.y <= boxBottom) {
      ids.push(id);
      seen.add(id);
    }
  }
  return ids;
}

function rectForNode(canvas: HTMLElement, id: string, revision: () => number): SelectionBox | null {
  revision();
  const canvasRect = canvas.getBoundingClientRect();
  const nodes = [...canvas.querySelectorAll<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)];
  const rects = nodes.flatMap((node) => {
    const direct = node.getBoundingClientRect();
    const descendants = [...node.querySelectorAll<HTMLElement>("*")].map((child) =>
      child.getBoundingClientRect(),
    );
    return [direct, ...descendants];
  });
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return {
    x: left - canvasRect.left,
    y: top - canvasRect.top,
    width: right - left,
    height: bottom - top,
  };
}

function normalizeReport(
  ids: string[],
  primary: string | null,
  source: SelectionReport["source"],
): SelectionReport {
  const unique = [...new Set(ids)];
  return {
    elementIds: unique,
    primaryElementId: primary && unique.includes(primary) ? primary : (unique[0] ?? null),
    source,
  };
}

export function SelectionCanvas(props: { children: JSX.Element }): JSX.Element {
  const context = useOpenScene();
  let canvas!: HTMLDivElement;
  const [selection, setSelection] = createSignal<string[]>([]);
  const [drag, setDrag] = createSignal<{ start: Point; current: Point } | null>(null);
  const [dragged, setDragged] = createSignal(false);

  createEffect(() => {
    const snapshot = context.snapshot();
    setSelection([...snapshot.selectedElementIds]);
  });
  const [geometryRevision, setGeometryRevision] = createSignal(0);
  createEffect(() => {
    void context.snapshot().document;
    const invalidate = () => setGeometryRevision((value) => value + 1);
    window.addEventListener("scroll", invalidate, true);
    window.addEventListener("resize", invalidate);
    onCleanup(() => {
      window.removeEventListener("scroll", invalidate, true);
      window.removeEventListener("resize", invalidate);
    });
  });

  const interactionMode = () => context.snapshot().interactionMode;
  const emitSelection = (report: SelectionReport) => {
    setSelection(report.elementIds);
    context.client.reportSelection(report);
  };
  const [hovered, setHovered] = createSignal<string | null>(null);
  const updateHover = (elementId: string | null) => {
    if (hovered() === elementId) return;
    setHovered(elementId);
    context.client.reportHover(elementId);
  };
  const point = (event: PointerEvent): Point => {
    const rect = canvas?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };
  const pointerDown = (event: PointerEvent) => {
    if (interactionMode() !== "select" || !canvas) return;
    const start = point(event);
    if (typeof canvas.setPointerCapture === "function") canvas.setPointerCapture(event.pointerId);
    setDrag({ start, current: start });
    setDragged(false);
  };
  const pointerMove = (event: PointerEvent) => {
    if (interactionMode() === "select") {
      updateHover(nodeIdFromTarget(event.target));
    }
    const active = drag();
    if (!active || !canvas) return;
    const current = point(event);
    if (Math.abs(current.x - active.start.x) > 4 || Math.abs(current.y - active.start.y) > 4)
      setDragged(true);
    setDrag({ start: active.start, current });
  };
  const pointerLeave = () => {
    updateHover(null);
  };
  // Hit-test by coordinates: pointer capture retargets pointer events to the
  // canvas, so event.target is unusable here.
  const nodeIdAt = (clientX: number, clientY: number): string | null => {
    const element = document.elementFromPoint(clientX, clientY);
    return nodeIdFromTarget(element);
  };
  const pointerUp = (event: PointerEvent) => {
    const active = drag();
    if (!active || !canvas) return;
    const current = point(event);
    const wasDragged = dragged();
    setDrag(null);
    if (wasDragged) {
      const box: SelectionBox = {
        x: Math.min(active.start.x, current.x),
        y: Math.min(active.start.y, current.y),
        width: Math.abs(current.x - active.start.x),
        height: Math.abs(current.y - active.start.y),
      };
      const ids = orderedNodeIds(canvas, box);
      emitSelection(normalizeReport(ids, ids[0] ?? null, "marquee"));
      return;
    }
    // Click-select on pointerup instead of the synthetic click event, so
    // element-level click handlers cannot swallow the selection.
    if (interactionMode() !== "select") return;
    const id = nodeIdAt(event.clientX, event.clientY);
    if (!id) {
      emitSelection({ elementIds: [], primaryElementId: null, source: "click" });
      return;
    }
    const currentSelection = selection();
    const additive = event.shiftKey || event.metaKey;
    if (!additive) {
      emitSelection({ elementIds: [id], primaryElementId: id, source: "click" });
      return;
    }
    const next = currentSelection.includes(id)
      ? currentSelection.filter((value) => value !== id)
      : [...currentSelection, id];
    emitSelection(normalizeReport(next, next.includes(id) ? id : (next[0] ?? null), "click"));
  };
  const overlayBox = () => {
    const active = drag();
    if (!active || !dragged()) return null;
    return {
      x: Math.min(active.start.x, active.current.x),
      y: Math.min(active.start.y, active.current.y),
      width: Math.abs(active.current.x - active.start.x),
      height: Math.abs(active.current.y - active.start.y),
    } satisfies SelectionBox;
  };

  return (
    <div
      ref={(element) => {
        canvas = element;
      }}
      data-open-scene-canvas="true"
      style={{ position: "relative", "min-height": "1px" }}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerLeave={pointerLeave}
    >
      {props.children}
      <div
        data-open-scene-overlay="true"
        style={{
          position: "absolute",
          inset: "0",
          "pointer-events": "none",
          "z-index": "2147483647",
        }}
      >
        <Show when={!dragged() && interactionMode() === "select" && hovered()} keyed>
          {(id) => (
            <Show when={canvas ? rectForNode(canvas, id, geometryRevision) : null}>
              {(value) => (
                <div
                  data-open-scene-hover={id}
                  style={{
                    position: "absolute",
                    left: `${value().x}px`,
                    top: `${value().y}px`,
                    width: `${value().width}px`,
                    height: `${value().height}px`,
                    border: "1px dashed rgba(13, 138, 255, 0.85)",
                    background: "rgba(13, 138, 255, 0.06)",
                    "pointer-events": "none",
                  }}
                />
              )}
            </Show>
          )}
        </Show>
        <For each={selection()}>
          {(id) => (
            <Show when={canvas ? rectForNode(canvas, id, geometryRevision) : null}>
              {(value) => (
                <div
                  data-open-scene-outline={id}
                  style={{
                    position: "absolute",
                    left: `${value().x}px`,
                    top: `${value().y}px`,
                    width: `${value().width}px`,
                    height: `${value().height}px`,
                    border: "2px solid #0d8aff",
                    "pointer-events": "none",
                  }}
                />
              )}
            </Show>
          )}
        </For>
        {(() => {
          const box = overlayBox();
          return box ? (
            <div
              data-open-scene-marquee="true"
              style={{
                position: "absolute",
                left: `${box.x}px`,
                top: `${box.y}px`,
                width: `${box.width}px`,
                height: `${box.height}px`,
                border: "1px dashed #0d8aff",
                background: "rgba(13, 138, 255, .12)",
                "pointer-events": "none",
              }}
            />
          ) : null;
        })()}
      </div>
    </div>
  );
}
