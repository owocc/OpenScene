import { useMemo } from "react";

import { CanvasArtboard } from "./canvas-artboard";
import { CanvasToolbar } from "./canvas-toolbar";
import { CanvasViewport } from "./canvas-viewport";
import { WebIframeRenderer } from "./renderers/web-iframe-renderer";
import type { CanvasRendererProps, StudioCanvasProps } from "./types";

/**
 * Encapsulated Studio Canvas Subsystem.
 *
 * Provides a unified, extensible multi-target canvas layer:
 * - Default: Web iframe canvas with Preview Bridge protocol
 * - Extensible: supports custom preview renderers and multi-surface modes
 * - Decoupled: camera viewport, physical artboard, and bottom toolbar are independently managed.
 */
export function StudioCanvas({
  kind = "web-iframe",
  surface,
  bootstrap,
  document,
  locale,
  revision,
  selectedId,
  viewport,
  activeToolMode,
  onPatchViewport,
  onSurfaceChange,
  onToolChange,
  onSelectNode,
  renderCustomPreview,
}: StudioCanvasProps) {
  const previewIdentity = useMemo(
    () => ({
      appKey: bootstrap.app.key,
      resourceId: bootstrap.resource.id,
      resourceKind: bootstrap.resource.kind,
    }),
    [bootstrap.app.key, bootstrap.resource.id, bootstrap.resource.kind],
  );

  const rendererProps: CanvasRendererProps = {
    url: bootstrap.preview.url,
    allowedOrigin: bootstrap.preview.allowedOrigin,
    identity: previewIdentity,
    document,
    locale,
    revision,
    selectedId,
    interactionMode: activeToolMode === "select" ? "select" : "preview",
    onSelect: onSelectNode,
  };

  const previewElement = renderCustomPreview ? (
    renderCustomPreview(rendererProps)
  ) : kind === "web-iframe" ? (
    <WebIframeRenderer {...rendererProps} />
  ) : null;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* 1. Full-screen Canvas Layer */}
      {surface === "text" ? (
        <div className="grid h-full w-full grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] bg-background">
          <div className="min-h-0 min-w-0 overflow-hidden border-r border-border">
            {previewElement}
          </div>
          <aside className="min-h-0 overflow-auto bg-background">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold">Document editor</span>
                <span className="rounded-md bg-muted px-1.5 py-1 text-[9px] text-muted-foreground">
                  placeholder
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                在这里编辑文档文本。当前仅作为编辑器占位，不会回写 AppDocument。
              </p>
            </div>
            <div className="grid gap-4 p-4">
              <label className="grid gap-1.5 text-[10px] font-medium text-muted-foreground">
                Title
                <input
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  defaultValue={document.pageInfo.title}
                  aria-label="Document title placeholder"
                />
              </label>
              <label className="grid gap-1.5 text-[10px] font-medium text-muted-foreground">
                Body text
                <textarea
                  className="min-h-52 resize-y rounded-lg border border-input bg-background p-2.5 text-xs leading-5 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  defaultValue={document.pageInfo.description}
                  placeholder="开始输入文档内容…"
                  aria-label="Document body text placeholder"
                />
              </label>
              <div className="rounded-lg border border-dashed border-border p-3 text-[10px] leading-4 text-muted-foreground">
                Revision {revision} · Text editing bridge will be connected in a later slice.
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <CanvasViewport
          viewport={viewport}
          activeToolMode={activeToolMode}
          onPatch={onPatchViewport}
        >
          <CanvasArtboard viewport={viewport}>{previewElement}</CanvasArtboard>
        </CanvasViewport>
      )}

      {/* 2. Floating Bottom Canvas Toolbar */}
      <CanvasToolbar
        activeToolMode={activeToolMode}
        surface={surface}
        onSurfaceChange={onSurfaceChange}
        onToolChange={onToolChange}
      />
    </div>
  );
}
