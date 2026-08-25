import { describe, expect, test, vi } from "vite-plus/test";
import { createEmptySceneDocument } from "@openscene-ai/protocol";
import { z } from "zod";
import {
  baseReactComponents,
  defineOpenSceneReactApp,
  defineOpenSceneReactComponent,
} from "../src/catalog.js";

vi.mock("@json-render/react", () => ({
  defineRegistry: () => ({ registry: {}, handlers: {} }),
  Renderer: () => null,
  useBoundProp: () => [undefined, () => {}],
  useStateValue: () => undefined,
  useAction: () => async () => {},
}));

vi.mock("../src/node.js", () => ({
  View: () => null,
  Text: () => null,
  Button: () => null,
}));

describe("OpenScene React catalog adapter", () => {
  test("generates a serializable manifest from definitions without renderer functions", () => {
    const custom = defineOpenSceneReactComponent({
      type: "Card",
      schema: z.object({ title: z.string() }),
      title: "Card",
      category: "layout",
      render: () => null,
    });
    const app = defineOpenSceneReactApp({ appKey: "test-app", components: [custom] });
    expect(app.manifest.app).toEqual({ key: "test-app", type: "web" });
    expect(app.manifest.components.Card.title).toBe("Card");
    expect(app.manifest.components.Card.props).toBeDefined();
    expect(JSON.stringify(app.manifest)).not.toContain("renderer");
    expect(JSON.stringify(app.manifest)).not.toContain("__opensceneNodeId");
    expect(app.catalog.componentNames).toContain("View");
    expect(app.catalog.componentNames).toContain("Card");
  });

  test("rejects named slots when the component is declared", () => {
    expect(() =>
      defineOpenSceneReactComponent({
        type: "Panel",
        schema: z.object({}),
        title: "Panel",
        slots: ["header"],
        render: () => null,
      }),
    ).toThrow('OpenScene React renderer does not support named slot "header"');
  });

  test("base components and canonical documents are catalog-compatible", () => {
    const app = defineOpenSceneReactApp();
    const document = createEmptySceneDocument();
    // A freshly created document has no root yet; json-render's spec
    // validation rejects it, which is why the renderer skips validation
    // until the author adds the first node.
    expect(app.catalog.validate(document.spec).success).toBe(false);
    const rooted = {
      ...document,
      spec: {
        root: "root",
        elements: { root: { type: "View", props: {}, children: [] } },
        state: {},
      },
    };
    expect(app.catalog.validate(rooted.spec).success).toBe(true);
    expect(Object.keys(baseReactComponents)).toEqual(["View", "Text", "Button"]);
  });
});
