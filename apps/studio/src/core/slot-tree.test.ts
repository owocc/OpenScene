import { describe, expect, it } from "vite-plus/test";
import { createEmptySceneDocument, type SceneDocument } from "@openscene/protocol";

import { buildTree, getElementLocation, isSlotNodeId } from "./slot-tree";

function createDocument(): SceneDocument {
  const empty = createEmptySceneDocument();
  return {
    ...empty,
    spec: {
      ...empty.spec,
      root: "header",
      elements: {
        header: { type: "Header", props: {}, children: ["title"], slots: { right: ["button"] } },
        title: { type: "Text", props: {} },
        button: { type: "Button", props: {} },
      },
    },
  };
}

describe("Studio slot tree", () => {
  it("keeps named slots as stable virtual nodes", () => {
    const tree = buildTree(createDocument(), (type) =>
      type === "Header"
        ? {
            type,
            title: type,
            runtime: { component: type },
            props: {},
            slots: { right: { title: "Right" } },
          }
        : undefined,
    );
    expect(tree?.children.map((node) => node.id)).toEqual(["title", "header:slot:right"]);
    expect(isSlotNodeId("header:slot:right")).toBe(true);
    expect(tree?.children[1]?.kind).toBe("slot");
  });

  it("resolves parents across children and slots", () => {
    const document = createDocument();
    expect(getElementLocation(document, "title")).toEqual({ parentId: "header", index: 0 });
    expect(getElementLocation(document, "button")).toEqual({
      parentId: "header",
      slotName: "right",
      index: 0,
    });
  });
});
