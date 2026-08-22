import { describe, expect, it } from "vite-plus/test";

import {
  isInputSchemaBase,
  isSizeSchema,
  isUnitSchema,
  isWebInputSchema,
  sizeFieldKeys,
  sizeFieldPresets,
  sizeSchema,
  unitSchema,
  webUnits,
  type SizeValue,
  type UnitValue,
} from "./index.js";

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
    expect(isWebInputSchema(unitSchema())).toBe(true);
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
