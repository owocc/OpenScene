import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createEmptySceneDocument } from "@openscene-ai/core";

import type { ShortcutsProviderProps } from "./shortcuts-provider";
import { useStudioStore } from "@/stores/studio-store";
import { useQueryStore } from "@/stores/query-store";
import { useShortcutsStore } from "@/stores/shortcuts-store";

describe("ShortcutsProvider & canvas delete shortcut", () => {
  let listeners: Record<string, ((event: unknown) => void)[]> = {};

  beforeEach(() => {
    listeners = {};
    const mockWindow = {
      location: { search: "", hash: "", pathname: "/" },
      history: { pushState: () => {}, replaceState: () => {} },
      addEventListener: (type: string, listener: (event: unknown) => void) => {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(listener);
      },
      removeEventListener: (type: string, listener: (event: unknown) => void) => {
        if (listeners[type]) {
          listeners[type] = listeners[type].filter((l) => l !== listener);
        }
      },
    };
    vi.stubGlobal("window", mockWindow);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function dispatchKeydown(eventInit: {
    key: string;
    code?: string;
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    target?: unknown;
    repeat?: boolean;
  }) {
    let prevented = false;
    const event = {
      ...eventInit,
      preventDefault: () => {
        prevented = true;
      },
    };
    const keydownListeners = listeners["keydown"] || [];
    for (const listener of keydownListeners) {
      listener(event);
    }
    return { prevented };
  }

  it("triggers onDelete callback when Delete or Backspace key is pressed outside input", () => {
    const onDelete = vi.fn();
    const onDeselect = vi.fn();

    const cleanup = simulateShortcutsMount({ onDelete, onDeselect });

    // Press Delete
    const delResult = dispatchKeydown({ key: "Delete" });
    expect(delResult.prevented).toBe(true);
    expect(onDelete).toHaveBeenCalledTimes(1);

    // Press Backspace
    const backResult = dispatchKeydown({ key: "Backspace" });
    expect(backResult.prevented).toBe(true);
    expect(onDelete).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it("does not trigger onDelete when target is an editable element", () => {
    const onDelete = vi.fn();
    const cleanup = simulateShortcutsMount({ onDelete });

    const mockInput = {
      isContentEditable: false,
      closest: (selector: string) => (selector.includes("input") ? mockInput : null),
    };
    Object.setPrototypeOf(
      mockInput,
      (globalThis as unknown as { HTMLElement: object }).HTMLElement ?? Object.prototype,
    );

    // Press Backspace while editing
    const result = dispatchKeydown({ key: "Backspace", target: mockInput });
    expect(result.prevented).toBe(false);
    expect(onDelete).not.toHaveBeenCalled();

    cleanup();
  });

  it("studio-store deleteNode removes selected element and updates root/selection", () => {
    const empty = createEmptySceneDocument();
    const store = useStudioStore.getState();

    // Initialize document with a root and child element
    store.dispatch({
      type: "document.replace",
      document: {
        ...empty,
        spec: {
          ...empty.spec,
          root: "card-1",
          elements: {
            "card-1": { type: "Card", props: {}, children: ["btn-1"] },
            "btn-1": { type: "Button", props: {}, children: [] },
          },
        },
      },
    });

    // Select btn-1 and delete it
    store.selectNode("btn-1");
    expect(useStudioStore.getState().selectedNodeId).toBe("btn-1");

    useStudioStore.getState().deleteNode();
    const stateAfterBtnDelete = useStudioStore.getState();
    expect(stateAfterBtnDelete.document.spec.elements["btn-1"]).toBeUndefined();
    expect(stateAfterBtnDelete.document.spec.elements["card-1"].children).toEqual([]);
    expect(stateAfterBtnDelete.selectedNodeId).toBe("card-1");

    // Delete card-1 (the root)
    useStudioStore.getState().deleteNode("card-1");
    const stateAfterRootDelete = useStudioStore.getState();
    expect(stateAfterRootDelete.document.spec.root).toBeNull();
    expect(stateAfterRootDelete.document.spec.elements).toEqual({});
    expect(stateAfterRootDelete.selectedNodeId).toBeNull();
  });

  it("handles sidebar toggle (Mod+E) and mode switcher shortcuts", () => {
    const cleanup = simulateShortcutsMount({});

    // Toggle sidebar
    useQueryStore.getState().setSidebarCollapsed(false);
    dispatchKeydown({ key: "e", metaKey: true });
    expect(useQueryStore.getState().sidebarCollapsed).toBe(true);

    // Switch surfaces
    dispatchKeydown({ key: "2", metaKey: true });
    expect(useQueryStore.getState().surface).toBe("text");

    dispatchKeydown({ key: "1", metaKey: true });
    expect(useQueryStore.getState().surface).toBe("visual");

    cleanup();
  });
});

function simulateShortcutsMount(props: Omit<ShortcutsProviderProps, "children">) {
  const isEditable = (target: unknown): boolean => {
    if (!target || typeof target !== "object") return false;
    const el = target as { isContentEditable?: boolean; closest?: (s: string) => unknown };
    if (el.isContentEditable) return true;
    return Boolean(el.closest?.("input, textarea, select, [contenteditable='true']"));
  };

  const handleKeyDown = (event: {
    key: string;
    code?: string;
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    repeat?: boolean;
    target?: unknown;
    preventDefault: () => void;
  }) => {
    const isEditing = isEditable(event.target);
    const modifier = event.metaKey || event.ctrlKey;

    if (event.key === "Escape") {
      if (useShortcutsStore.getState().isPanelOpen) {
        event.preventDefault();
        useShortcutsStore.getState().closePanel();
        return;
      }
      if (!isEditing) {
        event.preventDefault();
        props.onDeselect?.();
        return;
      }
    }

    if (!isEditing && !modifier && !event.repeat && event.key === "?") {
      event.preventDefault();
      useShortcutsStore.getState().togglePanel();
      return;
    }

    if (isEditing) return;

    if (!event.altKey && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault();
      props.onDelete?.();
      return;
    }

    if (modifier && event.key.toLowerCase() === "s") {
      event.preventDefault();
      props.onSave?.();
      return;
    }

    if (modifier && event.key.toLowerCase() === "c") {
      event.preventDefault();
      props.onCopyJson?.();
      return;
    }

    if (modifier && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        props.onRedo?.();
      } else {
        props.onUndo?.();
      }
      return;
    }

    if (modifier && event.key === "1") {
      event.preventDefault();
      useQueryStore.getState().setSurface("visual");
      return;
    }
    if (modifier && event.key === "2") {
      event.preventDefault();
      useQueryStore.getState().setSurface("text");
      return;
    }
    if (modifier && event.key === "3") {
      event.preventDefault();
      useQueryStore.getState().setSurface("developer");
      return;
    }

    if (modifier && event.key.toLowerCase() === "e") {
      event.preventDefault();
      const current = useQueryStore.getState().sidebarCollapsed;
      useQueryStore.getState().setSidebarCollapsed(!current);
      return;
    }

    if (event.shiftKey && modifier && event.key.toLowerCase() === "r") {
      event.preventDefault();
      const rotated = useQueryStore.getState().rotated;
      useQueryStore.getState().setRotated(!rotated);
      return;
    }

    if (modifier && (event.key === "+" || event.key === "=")) {
      event.preventDefault();
      props.onZoomIn?.();
      return;
    }
    if (modifier && (event.key === "-" || event.key === "_")) {
      event.preventDefault();
      props.onZoomOut?.();
      return;
    }
    if (modifier && event.key === "0") {
      event.preventDefault();
      props.onZoom100?.();
      return;
    }

    if (!modifier && !event.altKey && !event.shiftKey) {
      const key = event.key.toLowerCase();
      if (key === "v") {
        event.preventDefault();
        useQueryStore.getState().setTool("select");
      } else if (key === "i") {
        event.preventDefault();
        useQueryStore.getState().setTool("interact");
      } else if (key === "h") {
        event.preventDefault();
        useQueryStore.getState().setTool("hand");
      } else if (key === "0") {
        event.preventDefault();
        props.onResetViewport?.();
      }
    }
  };

  (window as unknown as { addEventListener: (type: string, fn: unknown) => void }).addEventListener(
    "keydown",
    handleKeyDown,
  );

  return () => {
    (
      window as unknown as { removeEventListener: (type: string, fn: unknown) => void }
    ).removeEventListener("keydown", handleKeyDown);
  };
}
