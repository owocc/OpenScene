import { describe, expect, it } from "vite-plus/test";
import { createEmptySceneDocument } from "@openscene/protocol";

import { createEditorState, editorReducer } from "./editor-state";

const emptyDocument = createEmptySceneDocument();

describe("Studio editor state", () => {
  it("normalizes multi-selection to known unique IDs and a valid primary", () => {
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
    expect(next.selectedNodeIds).toEqual(["button", "root"]);
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

  it("clamps zoom and keeps locale in sync with the canonical document", () => {
    const state = createEditorState(emptyDocument, 0);
    const zoomed = editorReducer(state, { type: "viewport.patch", patch: { zoom: 9 } });
    const next = editorReducer(state, { type: "locale.switch", locale: "zh-CN" });
    expect(zoomed.viewport.zoom).toBe(3);
    expect(next.locale).toBe("zh-CN");
    expect(next.document.pageInfo.locale).toBe("zh-CN");
    expect(next.document.spec.state?.lang).toBe("zh-CN");
  });
});
