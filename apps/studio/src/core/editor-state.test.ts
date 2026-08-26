import { describe, expect, it } from "vite-plus/test";
import { createEmptySceneDocument } from "@openscene-ai/core";

import { createEditorState, editorReducer } from "./editor-state";

const emptyDocument = createEmptySceneDocument();

describe("Studio editor state", () => {
  it("collapses multi-selection to a single valid node", () => {
    const state = createEditorState(
      {
        ...emptyDocument,
        spec: {
          ...emptyDocument.spec,
          elements: {
            root: { type: "View", props: {}, children: ["button"] },
            button: { type: "Button", props: {}, children: [] },
          },
        },
      },
      0,
    );
    const next = editorReducer(state, {
      type: "nodes.select",
      nodeIds: ["button", "missing", "button", "root"],
      primaryNodeId: "missing",
    });
    expect(next.selectedNodeIds).toEqual(["button"]);
    expect(next.selectedNodeId).toBe("button");
  });

  it("clears selection in hand mode and filters it after document replacement", () => {
    const state = createEditorState(emptyDocument, 0);
    const selected = editorReducer(state, {
      type: "nodes.select",
      nodeIds: ["root"],
      primaryNodeId: "root",
    });
    const hand = editorReducer(selected, { type: "tool.set", mode: "hand" });
    expect(hand.selectedNodeIds).toEqual([]);
    expect(hand.selectedNodeId).toBeNull();
    const replacement = {
      ...emptyDocument,
      spec: {
        ...emptyDocument.spec,
        elements: { next: { type: "View", props: {} } },
        root: "next",
      },
    };
    const replaced = editorReducer(selected, { type: "document.replace", document: replacement });
    expect(replaced.selectedNodeIds).toEqual([]);
    expect(replaced.selectedNodeId).toBeNull();
  });
  it("records history on document replacement so AI applications can be undone", () => {
    const state = createEditorState(emptyDocument, 0);
    const replacement = {
      ...emptyDocument,
      spec: {
        ...emptyDocument.spec,
        elements: { btn: { type: "Button", props: { text: "AI Generated" } } },
        root: "btn",
      },
    };
    const replaced = editorReducer(state, { type: "document.replace", document: replacement });
    expect(replaced.past.length).toBe(1);
    expect(replaced.document.spec.root).toBe("btn");

    // Undo should restore initial empty document
    const undone = editorReducer(replaced, { type: "history.undo" });
    expect(undone.document.spec.root).toBeNull();
    expect(undone.future.length).toBe(1);

    // Redo should restore the replaced document
    const redone = editorReducer(undone, { type: "history.redo" });
    expect(redone.document.spec.root).toBe("btn");
  });

  it("makes the first added node the root and clears it again on delete", () => {
    const state = createEditorState(emptyDocument, 0);
    const added = editorReducer(state, {
      type: "node.add",
      elementId: "view-1",
      element: { type: "View", props: {}, children: [] },
    });
    expect(added.document.spec.root).toBe("view-1");
    expect(added.selectedNodeId).toBe("view-1");

    const deleted = editorReducer(added, { type: "node.delete", elementId: "view-1" });
    expect(deleted.document.spec.root).toBeNull();
    expect(deleted.document.spec.elements).toEqual({});
    expect(deleted.selectedNodeId).toBeNull();
  });
});
