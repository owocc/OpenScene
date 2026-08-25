import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

import type { ActiveToolMode, ViewportState } from "@/core/editor-state";
import { useCanvasSettingsStore, type BackgroundTexture } from "@/stores/canvas-settings-store";
import { cn } from "@/lib/utils";

interface CanvasViewportProps {
  children: ReactNode;
  viewport: ViewportState;
  activeToolMode: ActiveToolMode;
  onPatch: (patch: Partial<ViewportState>) => void;
}

/**
 * Full-screen Canvas Viewport & Camera Engine.
 * Handles:
 * 1. Figma-style focal-point zoom (zooming towards mouse cursor)
 * 2. Two-finger trackpad panning / Shift horizontal scrolling
 * 3. Spacebar / Middle-click / Hand tool drag panning
 * 4. Theme-adaptive background texture (dots / grid, toggleable)
 */
const TEXTURE_CLASSES: Record<BackgroundTexture, string> = {
  dots: "bg-background bg-[radial-gradient(circle,rgba(100,116,139,0.25)_1px,transparent_1px)] dark:bg-[radial-gradient(circle,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:18px_18px]",
  grid: "bg-background [background-image:linear-gradient(to_right,rgba(100,116,139,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,116,139,0.18)_1px,transparent_1px)] dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:18px_18px]",
};
export function CanvasViewport({
  children,
  viewport,
  activeToolMode,
  onPatch,
}: CanvasViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; y: number; startX: number; startY: number } | undefined>(
    undefined,
  );
  const [isPanning, setIsPanning] = useState(false);
  // Always-fresh refs so wheel/gesture handlers never capture stale state.
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;
  const showBackgroundPattern = useCanvasSettingsStore((s) => s.showBackgroundPattern);
  const backgroundTexture = useCanvasSettingsStore((s) => s.backgroundTexture);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheelNative = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      const vp = viewportRef.current;
      const patch = onPatchRef.current;
      const isZoom = event.metaKey || event.ctrlKey;

      if (isZoom) {
        const rect = el.getBoundingClientRect();
        const cursorX = event.clientX - rect.left - rect.width / 2;
        const cursorY = event.clientY - rect.top - rect.height / 2;

        const factor = Math.exp(-event.deltaY * 0.005);
        const nextZoom = Math.min(Math.max(Number((vp.zoom * factor).toFixed(3)), 0.1), 5.0);

        const ratio = nextZoom / vp.zoom;
        const nextPanX = Number((cursorX - (cursorX - vp.panX) * ratio).toFixed(1));
        const nextPanY = Number((cursorY - (cursorY - vp.panY) * ratio).toFixed(1));

        patch({ zoom: nextZoom, panX: nextPanX, panY: nextPanY });
        return;
      }

      const deltaX = event.shiftKey ? event.deltaY : event.deltaX;
      const deltaY = event.shiftKey ? 0 : event.deltaY;
      patch({
        panX: Number((vp.panX - deltaX).toFixed(1)),
        panY: Number((vp.panY - deltaY).toFixed(1)),
      });
    };

    let gestureStartZoom = 1;
    let gestureStartPanX = 0;
    let gestureStartPanY = 0;

    const onGestureStart = (event: Event) => {
      event.preventDefault();
      const vp = viewportRef.current;
      gestureStartZoom = vp.zoom;
      gestureStartPanX = vp.panX;
      gestureStartPanY = vp.panY;
    };

    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const gestureEvent = event as Event & { scale?: number; clientX?: number; clientY?: number };
      const scale = gestureEvent.scale ?? 1;
      const rect = el.getBoundingClientRect();
      const cursorX =
        (gestureEvent.clientX ?? rect.left + rect.width / 2) - rect.left - rect.width / 2;
      const cursorY =
        (gestureEvent.clientY ?? rect.top + rect.height / 2) - rect.top - rect.height / 2;

      const nextZoom = Math.min(Math.max(Number((gestureStartZoom * scale).toFixed(3)), 0.1), 5.0);
      const ratio = nextZoom / gestureStartZoom;
      const nextPanX = Number((cursorX - (cursorX - gestureStartPanX) * ratio).toFixed(1));
      const nextPanY = Number((cursorY - (cursorY - gestureStartPanY) * ratio).toFixed(1));

      onPatchRef.current({ zoom: nextZoom, panX: nextPanX, panY: nextPanY });
    };

    const onGestureEnd = (event: Event) => {
      event.preventDefault();
    };

    el.addEventListener("wheel", onWheelNative, { passive: false });
    el.addEventListener("gesturestart", onGestureStart, { passive: false });
    el.addEventListener("gesturechange", onGestureChange, { passive: false });
    el.addEventListener("gestureend", onGestureEnd, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheelNative);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      el.removeEventListener("gestureend", onGestureEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount-once: handlers read live state via viewportRef / onPatchRef.

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (activeToolMode !== "hand" && event.button !== 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      x: viewport.panX,
      y: viewport.panY,
      startX: event.clientX,
      startY: event.clientY,
    };
    setIsPanning(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan) return;
    onPatch({
      panX: pan.x + event.clientX - pan.startX,
      panY: pan.y + event.clientY - pan.startY,
    });
  };

  const stopPan = () => {
    panRef.current = undefined;
    setIsPanning(false);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative min-h-0 flex-1 overflow-hidden",
        showBackgroundPattern ? TEXTURE_CLASSES[backgroundTexture] : "bg-background",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopPan}
      onPointerCancel={stopPan}
    >
      {/* Children (artboard + iframe) ignore pointer events while panning so the
          drag is not swallowed when the cursor moves over the iframe. */}
      <div
        className={cn(
          "absolute inset-0 grid place-items-center overflow-hidden",
          isPanning && "pointer-events-none",
        )}
      >
        {children}
      </div>
      {activeToolMode === "hand" && (
        <div
          className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
          aria-label="Pan canvas"
        />
      )}
    </div>
  );
}
