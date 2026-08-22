import type { AppDocument, AppElement } from "./document";
import {
  deleteElementRecursive,
  getElementLocation,
  insertElement,
  isSlotNodeId,
} from "./slot-tree";

export type Surface = "visual" | "text" | "developer" | "preview";
export type ActiveToolMode = "select" | "interact" | "hand";

export interface ViewportState {
  selectedDeviceId: string;
  currentDeviceWidth: number;
  currentDeviceHeight: number;
  isRotated: boolean;
  zoom: number;
  panX: number;
  panY: number;
}

export interface EditorState {
  document: AppDocument;
  selectedNodeId: string | null;
  past: AppDocument[];
  future: AppDocument[];
  revision: number;
  locale: string;
  surface: Surface;
  activeToolMode: ActiveToolMode;
  viewport: ViewportState;
}

export type EditorAction =
  | { type: "element.update"; elementId: string; element: AppElement }
  | {
      type: "node.add";
      elementId: string;
      element: AppElement;
      target?: Parameters<typeof insertElement>[2];
    }
  | { type: "node.delete"; elementId: string }
  | { type: "node.select"; nodeId: string | null }
  | { type: "document.replace"; document: AppDocument }
  | { type: "locale.switch"; locale: string }
  | { type: "surface.set"; surface: Surface }
  | { type: "tool.set"; mode: ActiveToolMode }
  | { type: "viewport.patch"; patch: Partial<ViewportState> }
  | { type: "history.undo" }
  | { type: "history.redo" };

export function createEditorState(document: AppDocument, revision: number): EditorState {
  return {
    document,
    selectedNodeId: document.spec.root || null,
    past: [],
    future: [],
    revision,
    locale: document.pageInfo.locale || "en-US",
    surface: "visual",
    activeToolMode: "select",
    viewport: {
      selectedDeviceId: "mobile",
      currentDeviceWidth: document.globalConfig.design.width ?? 390,
      currentDeviceHeight: 844,
      isRotated: false,
      zoom: 0.85,
      panX: 0,
      panY: 0,
    },
  };
}

function commit(state: EditorState, document: AppDocument, selectedNodeId = state.selectedNodeId) {
  if (document === state.document) return state;
  return {
    ...state,
    document,
    selectedNodeId,
    past: [...state.past.slice(-14), state.document],
    future: [],
    revision: state.revision + 1,
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "element.update": {
      if (!state.document.spec.elements[action.elementId]) return state;
      return commit(state, {
        ...state.document,
        spec: {
          ...state.document.spec,
          elements: {
            ...state.document.spec.elements,
            [action.elementId]: action.element,
          },
        },
      });
    }
    case "node.add": {
      const elements = { ...state.document.spec.elements, [action.elementId]: action.element };
      const next = insertElement(
        { ...state.document, spec: { ...state.document.spec, elements } },
        action.elementId,
        action.target,
      );
      return commit(state, next, action.elementId);
    }
    case "node.delete": {
      if (isSlotNodeId(action.elementId) || !state.document.spec.elements[action.elementId])
        return state;
      const parent = getElementLocation(state.document, action.elementId)?.parentId;
      const nextSelected = parent ?? null;
      return commit(state, deleteElementRecursive(state.document, action.elementId), nextSelected);
    }
    case "node.select":
      return { ...state, selectedNodeId: action.nodeId };
    case "document.replace":
      return {
        ...state,
        document: action.document,
        selectedNodeId: action.document.spec.root || null,
        locale: action.document.pageInfo.locale || "en-US",
        past: [],
        future: [],
        revision: state.revision + 1,
      };
    case "locale.switch":
      return {
        ...commit(state, {
          ...state.document,
          pageInfo: { ...state.document.pageInfo, locale: action.locale },
          spec: {
            ...state.document.spec,
            state: {
              ...state.document.spec.state,
              lang: action.locale,
            },
          },
        }),
        locale: action.locale,
      };
    case "surface.set":
      return { ...state, surface: action.surface };
    case "tool.set":
      return {
        ...state,
        activeToolMode: action.mode,
        selectedNodeId: action.mode === "hand" ? null : state.selectedNodeId,
      };
    case "viewport.patch":
      return {
        ...state,
        viewport: {
          ...state.viewport,
          ...action.patch,
          zoom: Math.min(3, Math.max(0.25, action.patch.zoom ?? state.viewport.zoom)),
        },
      };
    case "history.undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        document: previous,
        selectedNodeId: previous.spec.root || null,
        locale: previous.pageInfo.locale || "en-US",
        past: state.past.slice(0, -1),
        future: [state.document, ...state.future],
        revision: state.revision + 1,
      };
    }
    case "history.redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        document: next,
        selectedNodeId: next.spec.root || null,
        locale: next.pageInfo.locale || "en-US",
        past: [...state.past, state.document],
        future: state.future.slice(1),
        revision: state.revision + 1,
      };
    }
  }
}
