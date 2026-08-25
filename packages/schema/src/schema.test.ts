import { describe, expect, it } from "vite-plus/test";

import {
  isInputSchemaBase,
  isKeyValueSchema,
  isOpenApiSchema,
  isSizeSchema,
  isStyleSchema,
  isUnitSchema,
  isWebInputSchema,
  keyValueSchema,
  openApiMethods,
  openApiSchema,
  sizeFieldKeys,
  sizeFieldPresets,
  sizeSchema,
  styleSchema,
  unitSchema,
  webUnits,
  type SizeValue,
  type UnitValue,
} from "./index";

describe("unit schema", () => {
  it("defaults to the web unit list including viewport and px units", () => {
    const schema = unitSchema();
    expect(schema.type).toBe("unit");
    expect(schema.units).toContain("px");
    expect(schema.units).toContain("vw");
    expect(schema.units).toContain("vm");
    expect(schema.units).toEqual([...webUnits]);
  });

  it("allows overriding the selectable units", () => {
    const schema = unitSchema({ units: ["px", "rem"] });
    expect(schema.units).toEqual(["px", "rem"]);
  });

  it("carries optional editor metadata", () => {
    const schema = unitSchema({
      title: "Border radius",
      default: { value: 8, unit: "px" } satisfies UnitValue,
      required: true,
    });
    expect(schema.title).toBe("Border radius");
    expect(schema.default).toEqual({ value: 8, unit: "px" });
    expect(schema.required).toBe(true);
  });
});

describe("size schema", () => {
  it("defaults to width + height with px units", () => {
    const schema = sizeSchema();
    expect(schema.type).toBe("size");
    expect(schema.defaultUnit).toBe("px");
    expect(schema.fields.map((field) => field.key)).toEqual(["width", "height"]);
    expect(schema.fields[0]).toEqual({ key: "width", label: "Width" });
  });

  it("renders the requested dimension family with labels", () => {
    const schema = sizeSchema({ fields: ["minWidth", "minHeight", "maxWidth", "maxHeight"] });
    expect(schema.fields.map((field) => field.key)).toEqual([
      "minWidth",
      "minHeight",
      "maxWidth",
      "maxHeight",
    ]);
    expect(schema.fields[0].label).toBe("Min width");
  });

  it("accepts a default value per dimension", () => {
    const schema = sizeSchema({
      fields: ["width", "height"],
      default: { width: { value: 320, unit: "px" } } satisfies SizeValue,
    });
    expect(schema.default).toEqual({ width: { value: 320, unit: "px" } });
  });

  it("exposes every field key in the presets table", () => {
    expect(Object.keys(sizeFieldPresets).sort()).toEqual([...sizeFieldKeys].sort());
  });
});

describe("schema guards", () => {
  it("recognizes schema objects by their type", () => {
    expect(isUnitSchema(unitSchema())).toBe(true);
    expect(isSizeSchema(sizeSchema())).toBe(true);
    expect(isKeyValueSchema(keyValueSchema())).toBe(true);
    expect(isStyleSchema(styleSchema())).toBe(true);
    expect(isWebInputSchema(unitSchema())).toBe(true);
    expect(isWebInputSchema(keyValueSchema())).toBe(true);
    expect(isWebInputSchema(styleSchema())).toBe(true);
    expect(isWebInputSchema(sizeSchema({ fields: ["minWidth", "minHeight"] }))).toBe(true);
  });
  it("rejects non-schemas and unknown types", () => {
    expect(isInputSchemaBase(null)).toBe(false);
    expect(isInputSchemaBase("size")).toBe(false);
    expect(isInputSchemaBase({})).toBe(false);
    expect(isUnitSchema({ type: "size", units: [] })).toBe(false);
    expect(isSizeSchema({ type: "unit", fields: [] })).toBe(false);
    expect(isWebInputSchema({ type: "color", units: [] })).toBe(false);
    expect(isWebInputSchema(undefined)).toBe(false);
  });
});

describe("openapi schema", () => {
  it("defaults to the full method list", () => {
    const schema = openApiSchema();
    expect(schema.type).toBe("openapi");
    expect(schema.methods).toEqual([...openApiMethods]);
  });

  it("allows restricting the selectable methods", () => {
    const schema = openApiSchema({ methods: ["get"] });
    expect(schema.methods).toEqual(["get"]);
  });

  it("carries optional editor metadata", () => {
    const schema = openApiSchema({ title: "API", required: true });
    expect(schema.title).toBe("API");
    expect(schema.required).toBe(true);
  });

  it("is recognized by the openapi and web guards", () => {
    expect(isOpenApiSchema(openApiSchema())).toBe(true);
    expect(isWebInputSchema(openApiSchema())).toBe(true);
  });

  it("rejects openapi-shaped objects without a methods array", () => {
    expect(isOpenApiSchema({ type: "openapi" })).toBe(false);
    expect(isOpenApiSchema({ type: "openapi", methods: "get" })).toBe(false);
  });
});

describe("key-value schema", () => {
  it("creates a key-value schema with default control", () => {
    const schema = keyValueSchema({ title: "Custom styles", keyPlaceholder: "prop" });
    expect(schema.type).toBe("key-value");
    expect(schema.control).toBe("key-value");
    expect(schema.title).toBe("Custom styles");
    expect(schema.keyPlaceholder).toBe("prop");
  });

  it("is recognized by key-value and web guards", () => {
    expect(isKeyValueSchema(keyValueSchema())).toBe(true);
    expect(isKeyValueSchema({ type: "key-value" })).toBe(true);
    expect(isKeyValueSchema({ type: "keyValue" })).toBe(true);
    expect(isKeyValueSchema({ type: "other", control: "key-value" })).toBe(true);
    expect(isWebInputSchema(keyValueSchema())).toBe(true);
  });
});

describe("style schema", () => {
  it("creates a style schema with default control", () => {
    const schema = styleSchema({ title: "Styles", keyPlaceholder: "cssProperty" });
    expect(schema.type).toBe("style");
    expect(schema.control).toBe("style");
    expect(schema.title).toBe("Styles");
    expect(schema.keyPlaceholder).toBe("cssProperty");
  });

  it("is recognized by style and web guards", () => {
    expect(isStyleSchema(styleSchema())).toBe(true);
    expect(isStyleSchema({ type: "style" })).toBe(true);
    expect(isStyleSchema({ type: "other", control: "style" })).toBe(true);
    expect(isWebInputSchema(styleSchema())).toBe(true);
  });
});
