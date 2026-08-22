import { create } from "zustand";
import { createEmptySceneDocument } from "@openscene/protocol";

import type { JsonValue } from "@/core/document";
import {
  createEditorState,
  editorReducer,
  type ActiveToolMode,
  type EditorAction,
  type EditorElement,
  type EditorState,
  type Surface,
  type ViewportState,
} from "@/core/editor-state";
import type { StudioBootstrap } from "@/core/studio-bootstrap";

export interface StudioStoreState extends EditorState {
  bootstrap: StudioBootstrap | null;
  propertiesCollapsed: boolean;
  notice: string | null;
  init: (bootstrap: StudioBootstrap) => void;
  dispatch: (action: EditorAction) => void;
  setPropertiesCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  showNotice: (message: string) => void;
  updateElement: (id: string, updater: (element: EditorElement) => EditorElement) => void;
  updateProp: (name: string, value: JsonValue) => void;
  selectNode: (nodeId: string | null) => void;
  setSurface: (surface: Surface) => void;
  setToolMode: (mode: ActiveToolMode) => void;
  patchViewport: (patch: Partial<ViewportState>) => void;
  switchLocale: (locale: string) => void;
  undo: () => void;
  redo: () => void;
}

const initialState = createEditorState(createEmptySceneDocument(), 0);

export const useStudioStore = create<StudioStoreState>()((set, get) => ({
  ...initialState,
  bootstrap: null,
  propertiesCollapsed: false,
  notice: null,
  init: (bootstrap) =>
    set({ ...createEditorState(bootstrap.draft.document, bootstrap.draft.revision), bootstrap }),
  dispatch: (action) => set((state) => editorReducer(state, action)),
  setPropertiesCollapsed: (collapsed) =>
    set((state) => ({
      propertiesCollapsed:
        typeof collapsed === "function" ? collapsed(state.propertiesCollapsed) : collapsed,
    })),
  showNotice: (message) => {
    set({ notice: message });
    window.setTimeout(() => {
      if (get().notice === message) set({ notice: null });
    }, 1800);
  },
  updateElement: (id, updater) => {
    const current = get();
    const element = current.document.spec.elements[id] as EditorElement | undefined;
    if (element)
      current.dispatch({ type: "element.update", elementId: id, element: updater(element) });
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
  selectNode: (nodeId) =>
    get().dispatch({
      type: "nodes.select",
      nodeIds: nodeId ? [nodeId] : [],
      primaryNodeId: nodeId,
    }),
  setSurface: (surface) => get().dispatch({ type: "surface.set", surface }),
  setToolMode: (mode) => get().dispatch({ type: "tool.set", mode }),
  patchViewport: (patch) => get().dispatch({ type: "viewport.patch", patch }),
  switchLocale: (locale) => get().dispatch({ type: "locale.switch", locale }),
  undo: () => get().dispatch({ type: "history.undo" }),
  redo: () => get().dispatch({ type: "history.redo" }),
}));
