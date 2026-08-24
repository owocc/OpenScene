import { describe, expect, it } from "vite-plus/test";
import { createEmptySceneDocument } from "@openscene/protocol";

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
