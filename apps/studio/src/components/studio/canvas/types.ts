import type { AppType } from "@openscene-ai/core";
import type { AppManifest, ElementRect, SceneDocument } from "@openscene-ai/core";
import type { ReactNode } from "react";

import type { ActiveToolMode, Surface, ViewportState } from "@/core/editor-state";
import type { ComponentMeta } from "@/core/meta";
import type { StudioBootstrap } from "@/core/studio-bootstrap";

export type PreviewInteractionMode = "preview" | "select";

export interface PreviewIdentity {
  appKey: string;
  resourceId: string;
  resourceKind: "page" | "template";
}

export interface CanvasRendererProps {
  url: string;
  allowedOrigin: string;
  identity: PreviewIdentity;
  appType: AppType;
  document: SceneDocument;
  revision: number;
  selectedNodeIds: string[];
  primaryNodeId: string | null;
  interactionMode: PreviewInteractionMode;
  /** Canvas device size; changes (device preset switch) re-request geometry. */
  viewportSize?: { width: number; height: number };
  onSelectionChange: (nodeIds: string[], primaryNodeId: string | null) => void;
  onHoverElement?: (nodeId: string | null) => void;
  onGeometryChange?: (
    elementId: string,
    rect: ElementRect,
    scrollLeft: number,
    scrollTop: number,
  ) => void;
  /** A component card was dropped anywhere over the preview frame. */
  onFrameDrop?: () => void;
  onError?: (message: string) => void;
  /** Dev-mode only: called when the renderer pushes a local manifest via
   *  DEV_MANIFEST. Ignored in production sessions. */
  onDevManifest?: (manifest: AppManifest) => void;
}

export interface CanvasRendererAdapter {
  appType: AppType;
  render: (props: CanvasRendererProps) => ReactNode;
}

export interface StudioCanvasProps {
  surface: Surface;
  bootstrap: StudioBootstrap;
  document: SceneDocument;
  revision: number;
  selectedNodeIds: string[];
  primaryNodeId: string | null;
  viewport: ViewportState;
  activeToolMode: ActiveToolMode;
  components: ComponentMeta[];
  onAddComponent: (type: string) => void;
  pastLength?: number;
  futureLength?: number;
  onPatchViewport: (patch: Partial<ViewportState>) => void;
  onSurfaceChange: (surface: Surface) => void;
  onToolChange: (mode: ActiveToolMode) => void;
  onSelectionChange: (nodeIds: string[], primaryNodeId: string | null) => void;
  onHoverElement?: (nodeId: string | null) => void;
  onGeometryChange?: (
    elementId: string,
    rect: ElementRect,
    scrollLeft: number,
    scrollTop: number,
  ) => void;
  centerTargetNodeId?: string | null;
  onClearCenterTarget?: () => void;
  onFrameDrop?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCopyJson?: () => void;
  onSave?: () => void;
  onApplyDocument?: (document: SceneDocument) => void;
  /** Dev-mode only: surfaces DEV_MANIFEST from the renderer up to the editor. */
  onDevManifest?: (manifest: AppManifest) => void;
}
