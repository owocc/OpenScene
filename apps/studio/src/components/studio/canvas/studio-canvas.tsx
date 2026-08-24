import { useMemo } from "react";

import { APP_TYPE_WEB, type AppType } from "@openscene/constants";

import { CanvasSettingsDialog } from "./canvas-settings-dialog";
import { CanvasToolbar } from "./canvas-toolbar";
import { CanvasViewport } from "./canvas-viewport";
import { ShortcutsPanel } from "@/components/studio/shortcuts";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { WebIframeRenderer } from "./renderers/web-iframe-renderer";
import { useAgentChatStore } from "@/stores/agent-chat-store";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ShineBorder } from "@/components/ui/shine-border";
import { Astroid, CheckCheck, X } from "lucide-react";
import type { ElementRect } from "@openscene/protocol";
import type { CanvasRendererAdapter, CanvasRendererProps, StudioCanvasProps } from "./types";

export const canvasRendererRegistry: Record<AppType, CanvasRendererAdapter> = {
  [APP_TYPE_WEB]: {
    appType: APP_TYPE_WEB,
    render: (props) => <WebIframeRenderer {...props} />,
  },
};

function UnsupportedRenderer({ appType }: { appType: string }) {
  return (
    <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">
      <div>
        <p className="font-medium text-foreground">Unsupported App type</p>
        <p className="mt-1">Studio has no canvas renderer registered for “{appType}”.</p>
      </div>
    </div>
  );
}

export function StudioCanvas({
  surface,
  bootstrap,
  document,
  revision,
  selectedNodeIds,
  primaryNodeId,
  viewport,
  activeToolMode,
  components,
  onAddComponent,
  pastLength,
  futureLength,
  onPatchViewport,
  onSurfaceChange,
  onToolChange,
  onSelectionChange,
  onHoverElement,
  onGeometryChange: externalOnGeometryChange,
  centerTargetNodeId,
  onClearCenterTarget,
  onFrameDrop,
  onUndo,
  onRedo,
  onCopyJson,
  onSave,
  onApplyDocument,
}: StudioCanvasProps) {
  const aiPreviewDocument = useAgentChatStore((s) => s.aiPreviewDocument);
  const aiPreviewRevision = useAgentChatStore((s) => s.aiPreviewRevision);
  const isStreaming = useAgentChatStore((s) => s.isStreaming);
  const discardAiPreview = useAgentChatStore((s) => s.discardAiPreview);
  const previewIdentity = useMemo(
    () => ({
      appKey: bootstrap.app.key,
      resourceId: bootstrap.resource.id,
      resourceKind: bootstrap.resource.kind,
    }),
    [bootstrap.app.key, bootstrap.resource.id, bootstrap.resource.kind],
  );
  const handleGeometryChange = (
    elementId: string,
    rect: ElementRect,
    scrollLeft: number,
    scrollTop: number,
  ) => {
    externalOnGeometryChange?.(elementId, rect, scrollLeft, scrollTop);
    if (centerTargetNodeId === elementId && rect && (rect.width > 0 || rect.height > 0)) {
      onClearCenterTarget?.();
      const artboardW = viewport.isRotated
        ? viewport.currentDeviceHeight
        : viewport.currentDeviceWidth;
      const artboardH = viewport.isRotated
        ? viewport.currentDeviceWidth
        : viewport.currentDeviceHeight;

      const elemCenterX = rect.left + rect.width / 2;
      const elemCenterY = rect.top + rect.height / 2;

      const dx = elemCenterX - artboardW / 2;
      const dy = elemCenterY - artboardH / 2;

      const targetPanX = Math.round(-dx * viewport.zoom);
      const targetPanY = Math.round(-dy * viewport.zoom);

      onPatchViewport({
        panX: targetPanX,
        panY: targetPanY,
      });
    }
  };
  const rendererProps: CanvasRendererProps = {
    url: bootstrap.preview.url,
    allowedOrigin: bootstrap.preview.allowedOrigin,
    identity: previewIdentity,
    appType: bootstrap.app.type,
    document,
    revision,
    selectedNodeIds,
    primaryNodeId,
    interactionMode: activeToolMode === "select" ? "select" : "preview",
    viewportSize: {
      width: viewport.currentDeviceWidth ?? 0,
      height: viewport.currentDeviceHeight ?? 0,
    },
    onSelectionChange,
    onHoverElement,
    onGeometryChange: handleGeometryChange,
    onFrameDrop,
  };
  const adapter = canvasRendererRegistry[bootstrap.app.type];
  const previewElement = adapter ? (
    adapter.render(rendererProps)
  ) : (
    <UnsupportedRenderer appType={bootstrap.app.type} />
  );
  const aiRendererProps: CanvasRendererProps = useMemo(
    () => ({
      url: bootstrap.preview.url,
      allowedOrigin: bootstrap.preview.allowedOrigin,
      identity: previewIdentity,
      appType: bootstrap.app.type,
      document: aiPreviewDocument || document,
      revision: aiPreviewRevision,
      selectedNodeIds: [],
      primaryNodeId: null,
      interactionMode: "preview" as const,
      viewportSize: {
        width: viewport.currentDeviceWidth ?? 0,
        height: viewport.currentDeviceHeight ?? 0,
      },
      onSelectionChange: () => {},
      onHoverElement: () => {},
      onFrameDrop: () => {},
    }),
    [
      bootstrap.preview.url,
      bootstrap.preview.allowedOrigin,
      previewIdentity,
      bootstrap.app.type,
      aiPreviewDocument,
      document,
      aiPreviewRevision,
      viewport.currentDeviceWidth,
      viewport.currentDeviceHeight,
    ],
  );
  const aiPreviewElement = adapter && aiPreviewDocument ? adapter.render(aiRendererProps) : null;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {surface === "text" ? (
        <ResizablePanelGroup orientation="horizontal" className="h-full w-full bg-background">
          <ResizablePanel
            defaultSize="60%"
            minSize="30%"
            className="min-h-0 min-w-0 overflow-hidden"
          >
            <div className="h-full w-full overflow-hidden">{previewElement}</div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            defaultSize="40%"
            minSize="20%"
            maxSize="70%"
            className="min-h-0 overflow-auto bg-background"
          >
            <aside className="h-full overflow-auto bg-background">
              <div className="border-b border-border px-4 py-3">
                <span className="text-xs font-semibold">Document editor</span>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                  Canonical page information is edited in the Studio document.
                </p>
              </div>
              <div className="grid gap-4 p-4">
                <label className="grid gap-1.5 text-[10px] font-medium text-muted-foreground">
                  Title
                  <input
                    className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground"
                    defaultValue={document.pageInfo.title}
                    aria-label="Document title"
                  />
                </label>
                <label className="grid gap-1.5 text-[10px] font-medium text-muted-foreground">
                  Body text
                  <textarea
                    className="min-h-52 resize-y rounded-lg border border-input bg-background p-2.5 text-xs leading-5 text-foreground"
                    defaultValue={document.pageInfo.description}
                    aria-label="Document body text"
                  />
                </label>
                <div className="rounded-lg border border-dashed border-border p-3 text-[10px] leading-4 text-muted-foreground">
                  Revision {revision}
                </div>
              </div>
            </aside>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <CanvasViewport
          viewport={viewport}
          activeToolMode={activeToolMode}
          onPatch={onPatchViewport}
        >
          <div
            className="flex items-center justify-center gap-12 origin-center transition-transform duration-300 ease-out"
            style={{
              transform: `translate3d(${viewport.panX}px, ${viewport.panY}px, 0) scale(${viewport.zoom})`,
            }}
          >
            {/* 1. Main Canvas Artboard */}
            <div
              className="relative transition-all duration-150"
              style={{
                width: viewport.isRotated
                  ? viewport.currentDeviceHeight
                  : viewport.currentDeviceWidth,
                height: viewport.isRotated
                  ? viewport.currentDeviceWidth
                  : viewport.currentDeviceHeight,
              }}
            >
              <div className="absolute -top-7 left-0 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground select-none">
                <span>主画布</span>
                <span className="text-[10px] text-muted-foreground/60">rev {revision}</span>
              </div>
              <div className="relative h-full w-full border border-border bg-background shadow-md">
                {previewElement}
              </div>
            </div>

            {/* 2. Live AI Replica Canvas Artboard */}
            {aiPreviewDocument && (
              <div
                className="relative transition-all duration-150"
                style={{
                  width: viewport.isRotated
                    ? viewport.currentDeviceHeight
                    : viewport.currentDeviceWidth,
                  height: viewport.isRotated
                    ? viewport.currentDeviceWidth
                    : viewport.currentDeviceHeight,
                }}
              >
                {/* Header above artboard matching main canvas */}
                <div className="absolute -top-7 inset-x-0 flex items-center justify-between text-[11px] font-medium text-muted-foreground select-none">
                  <div className="flex items-center gap-1.5">
                    <Astroid className="size-3.5 text-foreground" />
                    <span className="font-semibold text-foreground">AI 实时副本画布</span>
                    {isStreaming && <Spinner className="size-3 text-foreground" />}
                  </div>
                  {/* Action buttons floating on the right */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="xs"
                      variant="default"
                      className="h-6 gap-1 px-2.5 text-[11px] font-medium shadow-xs"
                      onClick={() => {
                        if (aiPreviewDocument) {
                          onApplyDocument?.(aiPreviewDocument);
                          discardAiPreview();
                        }
                      }}
                    >
                      <CheckCheck className="size-3 text-emerald-300" />
                      <span>替换为主页面</span>
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="size-6 text-muted-foreground hover:text-foreground"
                      title="关闭实时副本"
                      onClick={discardAiPreview}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Artboard Container with ShineBorder matching main canvas */}
                <div className="relative h-full w-full border border-border bg-background shadow-md">
                  {aiPreviewElement}
                  <ShineBorder
                    borderWidth={2}
                    duration={8}
                    shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
                    className="z-40 pointer-events-none"
                  />
                </div>
              </div>
            )}
          </div>
        </CanvasViewport>
      )}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center justify-end">
        <div className="pointer-events-auto pb-4">
          <CanvasToolbar
            activeToolMode={activeToolMode}
            surface={surface}
            onSurfaceChange={onSurfaceChange}
            onToolChange={onToolChange}
            components={components}
            onAddComponent={onAddComponent}
            pastLength={pastLength}
            futureLength={futureLength}
            viewport={viewport}
            onPatchViewport={onPatchViewport}
            onUndo={onUndo}
            onRedo={onRedo}
            onCopyJson={onCopyJson}
            onSave={onSave}
          />
        </div>
        <div className="pointer-events-auto w-full">
          <ShortcutsPanel />
        </div>
      </div>
      <CanvasSettingsDialog />
    </div>
  );
}
