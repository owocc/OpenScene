import type { AppType } from "@openscene/constants";
import type { SceneDocument } from "@openscene/protocol";
import type { ReactNode } from "react";

import type { ActiveToolMode, Surface, ViewportState } from "@/core/editor-state";
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
  onSelectionChange: (nodeIds: string[], primaryNodeId: string | null) => void;
  onError?: (message: string) => void;
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
  pastLength?: number;
  futureLength?: number;
  onPatchViewport: (patch: Partial<ViewportState>) => void;
  onSurfaceChange: (surface: Surface) => void;
  onToolChange: (mode: ActiveToolMode) => void;
  onSelectionChange: (nodeIds: string[], primaryNodeId: string | null) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCopyJson?: () => void;
  onSave?: () => void;
}
