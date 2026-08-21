import { useRef, type PointerEvent, type ReactNode, type WheelEvent } from "react";

import type { ActiveToolMode, ViewportState } from "@/core/editor-state";

interface CanvasViewportProps {
  children: ReactNode;
  viewport: ViewportState;
  activeToolMode: ActiveToolMode;
  onPatch: (patch: Partial<ViewportState>) => void;
}

export function CanvasViewport({
  children,
  viewport,
  activeToolMode,
  onPatch,
}: CanvasViewportProps) {
  const panRef = useRef<{ x: number; y: number; startX: number; startY: number } | undefined>(
    undefined,
  );
  const width = viewport.isRotated ? viewport.currentDeviceHeight : viewport.currentDeviceWidth;
  const height = viewport.isRotated ? viewport.currentDeviceWidth : viewport.currentDeviceHeight;

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.metaKey || event.ctrlKey) {
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      onPatch({ zoom: viewport.zoom + delta });
      return;
    }
    if (event.shiftKey) return;
    onPatch({ panX: viewport.panX - event.deltaX, panY: viewport.panY - event.deltaY });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (activeToolMode !== "hand" && event.button !== 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      x: viewport.panX,
      y: viewport.panY,
      startX: event.clientX,
      startY: event.clientY,
    };
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
  };

  return (
    <div
      className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] [background-size:18px_18px]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopPan}
      onPointerCancel={stopPan}
      onWheel={onWheel}
    >
      <div className="absolute inset-0 grid place-items-center overflow-hidden">
        <div
          className="origin-center transition-transform duration-75"
          style={{
            width,
            height,
            transform: `translate3d(${viewport.panX}px, ${viewport.panY}px, 0) scale(${viewport.zoom})`,
          }}
        >
          <div className="h-full w-full overflow-hidden rounded-2xl border border-slate-300 bg-background shadow-2xl shadow-slate-900/20">
            {children}
          </div>
        </div>
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
