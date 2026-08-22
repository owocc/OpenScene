/**
 * Base types shared by every input schema in `@openscene/schema`.
 *
 * An input schema is the contract between a property definition and the
 * property editor: `type` names the schema family, and the editor maps that
 * family to a concrete input widget (unit picker, size box, color, …).
 */

/** JSON primitive values accepted by property inputs. */
export type JsonPrimitive = string | number | boolean | null;

/** JSON value shapes a property input can read or write. */
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/**
 * Common fields every input schema carries. The `type` discriminator
 * selects the input widget in the property editor; platform-specific
 * schemas extend this interface with their own fields.
 */
export interface InputSchemaBase<Type extends string = string> {
  type: Type;
  /** Label shown above the input. */
  title?: string;
  /** Longer description shown as a tooltip or hint. */
  description?: string;
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Default value for the property. */
  default?: JsonValue;
  /** Whether the property must be present. */
  required?: boolean;
  /** Optional override for the default widget of `type`. */
  control?: string;
}

/** Narrowing guard: any object with a string `type` is a candidate schema. */
export function isInputSchemaBase(value: unknown): value is InputSchemaBase {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}
