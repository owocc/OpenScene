import { create } from "zustand";
import { createEmptySceneDocument } from "@openscene/protocol";

import type { JsonValue } from "@/core/document";
import { isSlotNodeId } from "@/core/slot-tree";
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
  deleteNode: (nodeId?: string) => void;
  setSurface: (surface: Surface) => void;
  setToolMode: (mode: ActiveToolMode) => void;
  patchViewport: (patch: Partial<ViewportState>) => void;
  switchLocale: (locale: string) => void;
  setVariable: (key: string, value: unknown) => void;
  deleteVariable: (key: string) => void;
  renameVariable: (oldKey: string, newKey: string) => void;
  updateState: (state: Record<string, unknown>) => void;
  setI18nValue: (
    locale: string,
    key: string,
    value: string,
    defaultLocale?: string,
    allLocales?: string[],
  ) => void;
  addI18nKey: (
    key: string,
    value: string,
    currentLocale?: string,
    defaultLocale?: string,
    allLocales?: string[],
  ) => void;
  deleteI18nKey: (key: string) => void;
  renameI18nKey: (oldKey: string, newKey: string) => void;
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
  deleteNode: (nodeId) => {
    const targetId = nodeId ?? get().selectedNodeId;
    if (targetId && !isSlotNodeId(targetId)) {
      get().dispatch({ type: "node.delete", elementId: targetId });
    }
  },
  setSurface: (surface) => get().dispatch({ type: "surface.set", surface }),
  setToolMode: (mode) => get().dispatch({ type: "tool.set", mode }),
  patchViewport: (patch) => get().dispatch({ type: "viewport.patch", patch }),
  switchLocale: (locale) => get().dispatch({ type: "locale.switch", locale }),
  setVariable: (key, value) => get().dispatch({ type: "state.setVariable", key, value }),
  deleteVariable: (key) => get().dispatch({ type: "state.deleteVariable", key }),
  renameVariable: (oldKey, newKey) =>
    get().dispatch({ type: "state.renameVariable", oldKey, newKey }),
  updateState: (state) => get().dispatch({ type: "state.update", state }),
  setI18nValue: (locale, key, value, defaultLocale, allLocales) =>
    get().dispatch({ type: "i18n.setValue", locale, key, value, defaultLocale, allLocales }),
  addI18nKey: (key, value, currentLocale, defaultLocale, allLocales) =>
    get().dispatch({ type: "i18n.addKey", key, value, currentLocale, defaultLocale, allLocales }),
  deleteI18nKey: (key) => get().dispatch({ type: "i18n.deleteKey", key }),
  renameI18nKey: (oldKey, newKey) => get().dispatch({ type: "i18n.renameKey", oldKey, newKey }),
  undo: () => get().dispatch({ type: "history.undo" }),
  redo: () => get().dispatch({ type: "history.redo" }),
}));
