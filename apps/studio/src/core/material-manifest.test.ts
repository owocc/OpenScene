import { APP_TYPE_WEB } from "@openscene/constants";
import { describe, expect, it } from "vite-plus/test";

import { materialManifestToAdapterMeta } from "./material-manifest";

describe("App material manifest adapter", () => {
  it("maps union schema, enum and explicit editor metadata", () => {
    const adapter = materialManifestToAdapterMeta({
      protocolVersion: "1.0",
      app: { key: "demo", type: APP_TYPE_WEB },
      components: {
        Card: {
          title: "Card",
          slots: ["default", "footer"] as unknown as Record<string, unknown>,
          props: {
            tone: {
              anyOf: [{ type: "string" }, { enum: ["neutral", "brand"] }],
              title: "Tone",
            },
            width: {
              type: "number",
              "x-editor": "unit",
              "x-units": ["px", "%"],
            },
          },
        },
      },
    });

    const card = adapter.components[0];
    expect(card.slots).toEqual({ default: { title: "default" }, footer: { title: "footer" } });
    expect(card.props.tone.editor.control).toBe("select");
    expect(card.props.tone.editor.options).toEqual([
      { label: "neutral", value: "neutral" },
      { label: "brand", value: "brand" },
    ]);
    expect(card.props.width.editor).toMatchObject({ control: "unit", units: ["px", "%"] });
  });
});
