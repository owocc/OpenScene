import type { ReactNode } from "react";

import type { ViewportState } from "@/core/editor-state";

interface CanvasArtboardProps {
  viewport: ViewportState;
  children: ReactNode;
}

/**
 * Physical Canvas Artboard Frame.
 * Wraps the active canvas renderer with device dimensions, rotation, and sharp border.
 */
export function CanvasArtboard({ viewport, children }: CanvasArtboardProps) {
  const width = viewport.isRotated ? viewport.currentDeviceHeight : viewport.currentDeviceWidth;
  const height = viewport.isRotated ? viewport.currentDeviceWidth : viewport.currentDeviceHeight;

  return (
    <div
      className="origin-center transition-transform duration-75"
      style={{
        width,
        height,
        transform: `translate3d(${viewport.panX}px, ${viewport.panY}px, 0) scale(${viewport.zoom})`,
      }}
    >
      <div className="h-full w-full  border border-border bg-background">{children}</div>
    </div>
  );
}
