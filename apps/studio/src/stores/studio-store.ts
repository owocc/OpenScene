import { create } from "zustand";

import { normalizeAppDocument, type AppElement, type JsonValue } from "@/core/document";
import {
  createEditorState,
  editorReducer,
  type ActiveToolMode,
  type EditorAction,
  type EditorState,
  type Surface,
  type ViewportState,
} from "@/core/editor-state";
import type { StudioBootstrap } from "@/core/studio-bootstrap";

export interface StudioStoreState extends EditorState {
  bootstrap: StudioBootstrap | null;
  propertiesCollapsed: boolean;
  notice: string | null;

  // Actions
  init: (bootstrap: StudioBootstrap) => void;
  dispatch: (action: EditorAction) => void;
  setPropertiesCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  showNotice: (message: string) => void;
  updateElement: (id: string, updater: (element: AppElement) => AppElement) => void;
  updateProp: (name: string, value: JsonValue) => void;
  selectNode: (nodeId: string | null) => void;
  setSurface: (surface: Surface) => void;
  setToolMode: (mode: ActiveToolMode) => void;
  patchViewport: (patch: Partial<ViewportState>) => void;
  switchLocale: (locale: string) => void;
  undo: () => void;
  redo: () => void;
}

export const useStudioStore = create<StudioStoreState>()((set, get) => ({
  document: normalizeAppDocument({}),
  selectedNodeId: null,
  past: [],
  future: [],
  revision: 0,
  locale: "en-US",
  surface: "visual",
  activeToolMode: "select",
  viewport: {
    selectedDeviceId: "mobile",
    currentDeviceWidth: 390,
    currentDeviceHeight: 844,
    isRotated: false,
    zoom: 0.85,
    panX: 0,
    panY: 0,
  },
  bootstrap: null,
  propertiesCollapsed: false,
  notice: null,

  init: (bootstrap) => {
    const initial = createEditorState(bootstrap.draft.document, bootstrap.draft.revision);
    set({
      ...initial,
      bootstrap,
    });
  },

  dispatch: (action) => {
    const current = get();
    const next = editorReducer(current, action);
    set(next);
  },

  setPropertiesCollapsed: (collapsed) => {
    set((state) => ({
      propertiesCollapsed:
        typeof collapsed === "function" ? collapsed(state.propertiesCollapsed) : collapsed,
    }));
  },

  showNotice: (message) => {
    set({ notice: message });
    window.setTimeout(() => {
      if (get().notice === message) {
        set({ notice: null });
      }
    }, 1800);
  },

  updateElement: (id, updater) => {
    const current = get();
    const element = current.document.spec.elements[id];
    if (!element) return;
    get().dispatch({ type: "element.update", elementId: id, element: updater(element) });
  },

  updateProp: (name, value) => {
    const selectedId = get().selectedNodeId;
    if (!selectedId) return;
    get().updateElement(selectedId, (element) => {
      const props = { ...element.props };
      if (value === "") delete props[name];
      else props[name] = value;
      return { ...element, props };
    });
  },

  selectNode: (nodeId) => get().dispatch({ type: "node.select", nodeId }),
  setSurface: (surface) => get().dispatch({ type: "surface.set", surface }),
  setToolMode: (mode) => get().dispatch({ type: "tool.set", mode }),
  patchViewport: (patch) => get().dispatch({ type: "viewport.patch", patch }),
  switchLocale: (locale) => get().dispatch({ type: "locale.switch", locale }),
  undo: () => get().dispatch({ type: "history.undo" }),
  redo: () => get().dispatch({ type: "history.redo" }),
}));
