import { isInputSchemaBase, type InputSchemaBase } from "../schema";
import type { UnitValue } from "./unit";

/**
 * Dimension fields carried by the web size input. `width`/`height` are the
 * primary box dimensions; the min/max variants constrain them.
 */
export const sizeFieldKeys = [
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
] as const;

export type SizeFieldKey = (typeof sizeFieldKeys)[number];

/** One dimension row of a size input. */
export interface SizeField {
  key: SizeFieldKey;
  /** Input label, e.g. "Width". */
  label: string;
  /** Unit for this field; falls back to the schema's `defaultUnit`. */
  unit?: string;
}

/** The value shape of a size input: a unit value per dimension field. */
export type SizeValue = Partial<Record<SizeFieldKey, UnitValue>>;

/**
 * Width/height input schema. It directly carries the dimension fields the
 * input should render (width, height, min-width, min-height, …) together
 * with the unit each field falls back to.
 */
export interface SizeSchema extends InputSchemaBase<"size"> {
  type: "size";
  /** Dimension inputs to render, in order. */
  fields: SizeField[];
  /** Unit applied to fields without an explicit one. */
  defaultUnit: string;
}

export interface SizeSchemaInput {
  title?: string;
  description?: string;
  placeholder?: string;
  default?: SizeValue;
  required?: boolean;
  control?: string;
  /** Dimension inputs to render; defaults to width + height. */
  fields?: readonly SizeFieldKey[];
  /** Unit applied to fields without an explicit one; defaults to "px". */
  defaultUnit?: string;
}

/** Preset labels for every dimension field. */
export const sizeFieldPresets: Record<SizeFieldKey, SizeField> = {
  width: { key: "width", label: "Width" },
  height: { key: "height", label: "Height" },
  minWidth: { key: "minWidth", label: "Min width" },
  minHeight: { key: "minHeight", label: "Min height" },
  maxWidth: { key: "maxWidth", label: "Max width" },
  maxHeight: { key: "maxHeight", label: "Max height" },
};

/** Builds a size schema from a list of dimension keys and overrides. */
export function sizeSchema(input: SizeSchemaInput = {}): SizeSchema {
  const { fields = ["width", "height"], defaultUnit = "px", ...rest } = input;
  return {
    type: "size",
    fields: fields.map((key) => sizeFieldPresets[key]),
    defaultUnit,
    ...rest,
  };
}

/** Narrowing guard for `SizeSchema`. */
export function isSizeSchema(value: unknown): value is SizeSchema {
  return (
    isInputSchemaBase(value) &&
    (value as SizeSchema).type === "size" &&
    Array.isArray((value as SizeSchema).fields)
  );
}
