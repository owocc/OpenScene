import { describe, expect, it } from "vite-plus/test";

import type { AppDocument } from "./document";
import { createEditorState, editorReducer } from "./editor-state";

const emptyDocument: AppDocument = {
  schemaVersion: "1.0",
  pageInfo: { title: "", description: "", keywords: [], locale: "en-US", metadata: {} },
  globalConfig: { design: {}, body: {}, variables: {} },
  spec: { root: "", elements: {} },
};

describe("Studio editor state", () => {
  it("creates a root from the first material without a hidden node", () => {
    const state = createEditorState(emptyDocument, 0);
    const next = editorReducer(state, {
      type: "node.add",
      elementId: "button-1",
      element: { type: "Button" },
    });

    expect(next.document.spec.root).toBe("button-1");
    expect(Object.keys(next.document.spec.elements)).toEqual(["button-1"]);
  });

  it("deletes the root by returning to an empty spec", () => {
    const state = createEditorState(
      {
        ...emptyDocument,
        spec: { root: "root", elements: { root: { type: "View" } } },
      },
      1,
    );
    const next = editorReducer(state, { type: "node.delete", elementId: "root" });
    expect(next.document.spec).toEqual({ root: "", elements: {} });
    expect(next.selectedNodeId).toBeNull();
  });

  it("clamps zoom and clears selection in hand mode", () => {
    const state = createEditorState(emptyDocument, 0);
    const zoomed = editorReducer(state, {
      type: "viewport.patch",
      patch: { zoom: 9 },
    });
    const hand = editorReducer(
      { ...zoomed, selectedNodeId: "node-1" },
      { type: "tool.set", mode: "hand" },
    );
    expect(zoomed.viewport.zoom).toBe(3);
    expect(hand.selectedNodeId).toBeNull();
  });
});
