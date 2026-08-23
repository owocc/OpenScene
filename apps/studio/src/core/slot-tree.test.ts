import { describe, expect, it } from "vite-plus/test";
import { createEmptySceneDocument, type SceneDocument } from "@openscene/protocol";

import { buildPageTreeItems, getElementLocation, isSlotNodeId } from "./slot-tree";

function createDocument(): SceneDocument {
  const empty = createEmptySceneDocument();
  return {
    ...empty,
    spec: {
      ...empty.spec,
      root: "header",
      elements: {
        header: {
          type: "Header",
          props: {},
          children: ["title", "nested"],
          slots: { right: ["button"], empty: [] },
        },
        title: { type: "Text", props: {} },
        nested: { type: "View", props: {}, children: ["deep"] },
        deep: { type: "Text", props: {} },
        button: { type: "Button", props: {} },
      },
    },
  };
}

const headerMeta = {
  type: "Header",
  title: "Header",
  runtime: { component: "Header" },
  props: {},
  slots: { right: { title: "Right" } },
};

describe("Studio slot tree", () => {
  it("resolves flat spec elements into a nested tree", () => {
    const items = buildPageTreeItems(createDocument(), (type) =>
      type === "Header" ? headerMeta : undefined,
    );
    expect(items?.["header"].children).toEqual([
      "title",
      "nested",
      "header:slot:right",
      "header:slot:empty",
    ]);
    expect(items?.["nested"].children).toEqual(["deep"]);
    expect(items?.["deep"].kind).toBe("element");
    expect(items?.["title"].children).toEqual([]);
  });

  it("keeps named slots as stable virtual nodes", () => {
    const items = buildPageTreeItems(createDocument(), (type) =>
      type === "Header" ? headerMeta : undefined,
    );
    const right = items?.["header:slot:right"];
    expect(right).toMatchObject({ kind: "slot", label: "Right", children: ["button"] });
    expect(isSlotNodeId("header:slot:right")).toBe(true);
    const empty = items?.["header:slot:empty"];
    expect(empty).toMatchObject({ kind: "slot", label: "empty", children: [] });
  });

  it("marks content so leaf vs container icons can differ", () => {
    const items = buildPageTreeItems(createDocument(), (type) =>
      type === "Header" ? headerMeta : undefined,
    );
    expect(items?.["header"].hasContent).toBe(true); // children + right slot content
    expect(items?.["nested"].hasContent).toBe(true); // child element
    expect(items?.["title"].hasContent).toBe(false); // leaf
    expect(items?.["deep"].hasContent).toBe(false); // leaf
  });

  it("rejects unresolvable roots and guards cycles", () => {
    const empty = createEmptySceneDocument();
    expect(
      buildPageTreeItems({ ...empty, spec: { ...empty.spec, root: "missing" } }, () => undefined),
    ).toBeNull();

    const cyclic = createDocument();
    cyclic.spec = {
      ...cyclic.spec,
      elements: {
        ...cyclic.spec.elements,
        header: { type: "Header", props: {}, children: ["header"] },
      },
    };
    const items = buildPageTreeItems(cyclic, (type) =>
      type === "Header" ? headerMeta : undefined,
    );
    expect(items?.["header"].children).toEqual(["header:slot:right"]); // self-reference dropped; manifest-declared slot stays (empty)
    expect(items?.["header"].hasContent).toBe(false);
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
