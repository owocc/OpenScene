import { isInputSchemaBase, type InputSchemaBase, type JsonValue } from "../schema.ts";

export type StyleRecord = Record<string, JsonValue>;

/**
 * Style map input schema. The property editor renders a style editor
 * adapted to the target platform (e.g. Web CSS properties, React Native styles).
 */
export interface StyleSchema extends InputSchemaBase<"style"> {
  type: "style";
  /** Placeholder for the key input (e.g. "Property", "Key"). */
  keyPlaceholder?: string;
  /** Placeholder for the value input (e.g. "Value"). */
  valuePlaceholder?: string;
  /** Suggested style property options / keywords for autocomplete. */
  keywords?: string[];
  allowCustomKeys?: boolean;
}

export interface StyleSchemaInput {
  title?: string;
  description?: string;
  placeholder?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  keywords?: readonly string[];
  default?: StyleRecord;
  required?: boolean;
  control?: string;
  allowCustomKeys?: boolean;
}

/** Builds a style schema. */
export function styleSchema(input: StyleSchemaInput = {}): StyleSchema {
  const { keywords, ...rest } = input;
  return {
    type: "style",
    control: "style",
    keywords: keywords ? [...keywords] : undefined,
    ...rest,
  };
}

/** Narrowing guard for `StyleSchema`. */
export function isStyleSchema(value: unknown): value is StyleSchema {
  return (
    isInputSchemaBase(value) &&
    ((value as StyleSchema).type === "style" ||
      (value as { control?: unknown }).control === "style")
  );
}
