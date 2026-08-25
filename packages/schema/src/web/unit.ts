import { isInputSchemaBase, type InputSchemaBase } from "../schema.ts";

/**
 * CSS units offered by the web unit input. `vm` is the viewport-max unit
 * (1vm = 1% of the larger viewport dimension); the `*vw`/`*vh` families are
 * the small/large/dynamic viewport variants.
 */
export const webUnits = [
  "px",
  "rem",
  "em",
  "%",
  "vw",
  "vh",
  "vmin",
  "vmax",
  "vm",
  "svw",
  "svh",
  "lvw",
  "lvh",
  "dvw",
  "dvh",
  "ch",
  "ex",
  "pt",
  "pc",
] as const;

export type WebUnit = (typeof webUnits)[number];

/** A dimension expressed as a number plus its unit (e.g. 16 px). */
export type UnitValue = {
  value: number;
  unit: string;
};

/**
 * The most basic input schema: a unit value. The schema itself stores the
 * set of selectable units; the input widget renders a number field with a
 * unit dropdown built from `units`.
 */
export interface UnitSchema extends InputSchemaBase<"unit"> {
  type: "unit";
  /** Units selectable in the input; defaults to `webUnits`. */
  units: string[];
}

export interface UnitSchemaInput {
  title?: string;
  description?: string;
  placeholder?: string;
  default?: UnitValue;
  required?: boolean;
  control?: string;
  /** Units selectable in the input; defaults to `webUnits`. */
  units?: readonly string[];
}

/** Builds a unit schema, defaulting the selectable units to `webUnits`. */
export function unitSchema(input: UnitSchemaInput = {}): UnitSchema {
  const { units, ...rest } = input;
  return { type: "unit", units: [...(units ?? webUnits)], ...rest };
}

/** Narrowing guard for `UnitSchema`. */
export function isUnitSchema(value: unknown): value is UnitSchema {
  return (
    isInputSchemaBase(value) &&
    (value as UnitSchema).type === "unit" &&
    Array.isArray((value as UnitSchema).units)
  );
}
