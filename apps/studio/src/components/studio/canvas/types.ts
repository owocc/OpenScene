import type { SceneDocumentSnapshot } from "@openscene/protocol";
import type { ReactNode } from "react";

import type { AppDocument } from "@/core/document";
import type { ActiveToolMode, Surface, ViewportState } from "@/core/editor-state";
import type { StudioBootstrap } from "@/core/studio-bootstrap";

export type CanvasKind = "web-iframe" | "native" | "text";

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
  document: AppDocument;
  locale: string;
  revision: number;
  selectedId: string;
  interactionMode: PreviewInteractionMode;
  onSelect: (id: string) => void;
  onRemoteDocument?: (document: SceneDocumentSnapshot) => void;
}

export interface StudioCanvasProps {
  kind?: CanvasKind;
  surface: Surface;
  bootstrap: StudioBootstrap;
  document: AppDocument;
  locale: string;
  revision: number;
  selectedId: string;
  viewport: ViewportState;
  activeToolMode: ActiveToolMode;
  pastLength?: number;
  futureLength?: number;
  onPatchViewport: (patch: Partial<ViewportState>) => void;
  onSurfaceChange: (surface: Surface) => void;
  onToolChange: (mode: ActiveToolMode) => void;
  onSelectNode: (id: string | null) => void;
  onRemoteDocument?: (document: SceneDocumentSnapshot) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCopyJson?: () => void;
  onSave?: () => void;
  renderCustomPreview?: (props: CanvasRendererProps) => ReactNode;
}
