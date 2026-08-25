import type { SceneDocument, UIElement } from "@openscene/protocol";

import {
  addI18nKeyInDocument,
  deleteI18nKeyInDocument,
  deleteVariableInDocument,
  renameI18nKeyInDocument,
  renameVariableInDocument,
  setI18nValueInDocument,
  setVariableInDocument,
} from "./document";
import {
  deleteElementRecursive,
  getElementLocation,
  insertElement,
  isSlotNodeId,
  moveElement,
} from "./slot-tree";
export type EditorElement = UIElement & { name?: string };
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
  document: SceneDocument;
  selectedNodeIds: string[];
  selectedNodeId: string | null;
  past: SceneDocument[];
  future: SceneDocument[];
  revision: number;
  locale: string;
  surface: Surface;
  activeToolMode: ActiveToolMode;
  viewport: ViewportState;
}

export type EditorAction =
  | { type: "element.update"; elementId: string; element: EditorElement }
  | {
      type: "node.add";
      elementId: string;
      element: EditorElement;
      target?: Parameters<typeof insertElement>[2];
    }
  | { type: "node.reorder"; elementId: string; parentId: string; index?: number }
  | { type: "node.delete"; elementId: string }
  | { type: "nodes.select"; nodeIds: string[]; primaryNodeId: string | null }
  | { type: "document.replace"; document: SceneDocument }
  | { type: "locale.switch"; locale: string }
  | { type: "surface.set"; surface: Surface }
  | { type: "tool.set"; mode: ActiveToolMode }
  | { type: "viewport.patch"; patch: Partial<ViewportState> }
  | { type: "history.undo" }
  | { type: "history.redo" }
  | { type: "state.setVariable"; key: string; value: unknown }
  | { type: "state.deleteVariable"; key: string }
  | { type: "state.renameVariable"; oldKey: string; newKey: string }
  | { type: "state.update"; state: Record<string, unknown> }
  | {
      type: "i18n.setValue";
      locale: string;
      key: string;
      value: string;
      defaultLocale?: string;
      allLocales?: string[];
    }
  | {
      type: "i18n.addKey";
      key: string;
      value: string;
      currentLocale?: string;
      defaultLocale?: string;
      allLocales?: string[];
    }
  | { type: "i18n.deleteKey"; key: string }
  | { type: "i18n.renameKey"; oldKey: string; newKey: string };
function selectedForDocument(
  document: SceneDocument,
  nodeIds: readonly string[],
  primary: string | null,
) {
  const ids = [...new Set(nodeIds)].filter((id) => id in document.spec.elements);
  return {
    selectedNodeIds: ids,
    selectedNodeId: primary && ids.includes(primary) ? primary : (ids[0] ?? null),
  };
}

function documentWidth(document: SceneDocument) {
  const design = document.globalConfig.design;
  return typeof design === "object" &&
    design !== null &&
    "width" in design &&
    typeof design.width === "number"
    ? design.width
    : 390;
}

export function createEditorState(document: SceneDocument, revision: number): EditorState {
  return {
    document,
    ...selectedForDocument(
      document,
      document.spec.root !== null ? [document.spec.root] : [],
      document.spec.root,
    ),
    past: [],
    future: [],
    revision,
    locale: document.pageInfo.locale || "en-US",
    surface: "visual",
    activeToolMode: "select",
    viewport: {
      selectedDeviceId: "mobile",
      currentDeviceWidth: documentWidth(document),
      currentDeviceHeight: 844,
      isRotated: false,
      zoom: 0.85,
      panX: 0,
      panY: 0,
    },
  };
}

function commit(
  state: EditorState,
  document: SceneDocument,
  selection = selectedForDocument(document, state.selectedNodeIds, state.selectedNodeId),
) {
  if (document === state.document) return state;
  return {
    ...state,
    document,
    ...selection,
    past: [...state.past.slice(-14), state.document],
    future: [],
    revision: state.revision + 1,
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "element.update":
      if (!state.document.spec.elements[action.elementId]) return state;
      return commit(state, {
        ...state.document,
        spec: {
          ...state.document.spec,
          elements: { ...state.document.spec.elements, [action.elementId]: action.element },
        },
      });
    case "node.add": {
      // json-render requires an explicit children array on every element;
      // default it here so no insertion path can produce a malformed node.
      const element = { children: [], ...action.element };
      const elements = { ...state.document.spec.elements, [action.elementId]: element };
      const next = insertElement(
        { ...state.document, spec: { ...state.document.spec, elements } },
        action.elementId,
        action.target,
      );
      return commit(state, next, selectedForDocument(next, [action.elementId], action.elementId));
    }
    case "node.reorder": {
      const next = moveElement(state.document, action.elementId, {
        parentId: action.parentId,
        index: action.index,
      });
      return commit(state, next);
    }
    case "node.delete": {
      if (isSlotNodeId(action.elementId) || !state.document.spec.elements[action.elementId])
        return state;
      const parent = getElementLocation(state.document, action.elementId)?.parentId;
      const next = deleteElementRecursive(state.document, action.elementId);
      return commit(state, next, selectedForDocument(next, parent ? [parent] : [], parent ?? null));
    }
    case "nodes.select": {
      // Studio selection is single: the primary node wins; when it is
      // unknown, fall back to the first valid node id.
      const primary = action.primaryNodeId ?? action.nodeIds[0] ?? null;
      const single =
        primary && primary in state.document.spec.elements
          ? [primary]
          : action.nodeIds.filter((id) => id in state.document.spec.elements).slice(0, 1);
      return {
        ...state,
        ...selectedForDocument(state.document, single, single[0] ?? null),
      };
    }
    case "document.replace":
      return {
        ...commit(state, action.document),
        locale: action.document.pageInfo?.locale || state.locale || "en-US",
      };
    case "locale.switch": {
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
    }
    case "surface.set":
      return { ...state, surface: action.surface };
    case "tool.set":
      return {
        ...state,
        activeToolMode: action.mode,
        ...(action.mode === "hand" ? selectedForDocument(state.document, [], null) : {}),
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
        ...selectedForDocument(previous, state.selectedNodeIds, state.selectedNodeId),
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
        ...selectedForDocument(next, state.selectedNodeIds, state.selectedNodeId),
        locale: next.pageInfo.locale || "en-US",
        past: [...state.past, state.document],
        future: state.future.slice(1),
        revision: state.revision + 1,
      };
    }
    case "state.setVariable": {
      const nextDoc = setVariableInDocument(state.document, action.key, action.value);
      return commit(state, nextDoc);
    }
    case "state.deleteVariable": {
      const nextDoc = deleteVariableInDocument(state.document, action.key);
      return commit(state, nextDoc);
    }
    case "state.renameVariable": {
      const nextDoc = renameVariableInDocument(state.document, action.oldKey, action.newKey);
      return commit(state, nextDoc);
    }
    case "state.update": {
      return commit(state, {
        ...state.document,
        spec: {
          ...state.document.spec,
          state: action.state,
        },
      });
    }
    case "i18n.setValue": {
      const nextDoc = setI18nValueInDocument(
        state.document,
        action.locale,
        action.key,
        action.value,
        action.defaultLocale ?? state.document.pageInfo?.locale ?? "en-US",
        action.allLocales,
      );
      return commit(state, nextDoc);
    }
    case "i18n.addKey": {
      const nextDoc = addI18nKeyInDocument(
        state.document,
        action.key,
        action.value,
        action.currentLocale ?? state.locale ?? "en-US",
        action.defaultLocale ?? state.document.pageInfo?.locale ?? "en-US",
        action.allLocales,
      );
      return commit(state, nextDoc);
    }
    case "i18n.deleteKey": {
      const nextDoc = deleteI18nKeyInDocument(state.document, action.key);
      return commit(state, nextDoc);
    }
    case "i18n.renameKey": {
      const nextDoc = renameI18nKeyInDocument(state.document, action.oldKey, action.newKey);
      return commit(state, nextDoc);
    }
  }
}
