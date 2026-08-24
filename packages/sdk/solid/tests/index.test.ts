import { describe, expect, test, vi } from "vite-plus/test";
import { createEmptySceneDocument } from "@openscene/protocol";
import { z } from "zod";
import {
  baseSolidComponents,
  defineOpenSceneSolidApp,
  defineOpenSceneSolidComponent,
} from "../src/catalog.ts";

vi.mock("@json-render/solid", () => ({
  defineRegistry: () => ({ registry: {}, handlers: {} }),
}));
vi.mock("../src/node.js", () => ({
  View: () => null,
  Text: () => null,
  Button: () => null,
}));

describe("OpenScene Solid catalog adapter", () => {
  test("generates a serializable manifest from definitions without renderer functions", () => {
    const custom = defineOpenSceneSolidComponent({
      type: "Card",
      schema: z.object({ title: z.string() }),
      title: "Card",
      category: "layout",
      render: () => null,
    });
    const app = defineOpenSceneSolidApp({ appKey: "test-app", components: [custom] });
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
      defineOpenSceneSolidComponent({
        type: "Panel",
        schema: z.object({}),
        title: "Panel",
        slots: ["header"],
        render: () => null,
      }),
    ).toThrow('OpenScene Solid renderer does not support named slot "header"');
  });

  test("base components and canonical documents are catalog-compatible", () => {
    const app = defineOpenSceneSolidApp();
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
    expect(Object.keys(baseSolidComponents)).toEqual(["View", "Text", "Button"]);
  });
});
