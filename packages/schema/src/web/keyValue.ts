import { isInputSchemaBase, type InputSchemaBase, type JsonValue } from "../schema.js";

export type KeyValueRecord = Record<string, JsonValue>;

/**
 * Key-value map input schema. The property editor renders a dual-input
 * key-value list where users can add, edit, and delete arbitrary or suggested
 * properties.
 */
export interface KeyValueSchema extends InputSchemaBase<"key-value"> {
  type: "key-value";
  /** Placeholder for the key input (e.g. "Property", "Key"). */
  keyPlaceholder?: string;
  /** Placeholder for the value input (e.g. "Value"). */
  valuePlaceholder?: string;
  /** Suggested key options / keywords for autocomplete. */
  keywords?: string[];
  allowCustomKeys?: boolean;
}

export interface KeyValueSchemaInput {
  title?: string;
  description?: string;
  placeholder?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  keywords?: readonly string[];
  default?: KeyValueRecord;
  required?: boolean;
  control?: string;
  allowCustomKeys?: boolean;
}

/** Builds a key-value schema. */
export function keyValueSchema(input: KeyValueSchemaInput = {}): KeyValueSchema {
  const { keywords, ...rest } = input;
  return {
    type: "key-value",
    control: "key-value",
    keywords: keywords ? [...keywords] : undefined,
    ...rest,
  };
}

/** Narrowing guard for `KeyValueSchema`. */
export function isKeyValueSchema(value: unknown): value is KeyValueSchema {
  return (
    isInputSchemaBase(value) &&
    ((value as KeyValueSchema).type === "key-value" ||
      (value as { type?: unknown }).type === "keyValue" ||
      (value as { control?: unknown }).control === "key-value" ||
      (value as { control?: unknown }).control === "keyValue")
  );
}
