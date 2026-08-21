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
  onPatchViewport: (patch: Partial<ViewportState>) => void;
  onSurfaceChange: (surface: Surface) => void;
  onToolChange: (mode: ActiveToolMode) => void;
  onRotate: () => void;
  onSelectNode: (id: string | null) => void;
  renderCustomPreview?: (props: CanvasRendererProps) => ReactNode;
}
