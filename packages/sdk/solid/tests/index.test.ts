import { describe, expect, test } from "vite-plus/test";
import { z } from "zod";

import { defineOpenSceneSolidApp, defineOpenSceneSolidComponent } from "../src/catalog.ts";

describe("OpenScene Solid catalog adapter", () => {
  test("generates a serializable manifest and renderer registry", () => {
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
    expect(app.registry.Card).toBe(custom.render);
    expect(app.componentDefinitions.Card).toBe(custom);
    expect(JSON.stringify(app.manifest)).not.toContain("renderer");
    expect(JSON.stringify(app.manifest)).not.toContain("__opensceneNodeId");
  });

  test("requires a schema for every component definition", () => {
    expect(() =>
      defineOpenSceneSolidComponent({
        type: "Panel",
        title: "Panel",
        render: () => null,
      }),
    ).toThrow('OpenScene Solid component "Panel" requires a schema');
  });
});
