import { isSizeSchema, type SizeSchema } from "./size";
import { isUnitSchema, type UnitSchema } from "./unit";
import { isKeyValueSchema, type KeyValueSchema } from "./keyValue";
import { isStyleSchema, type StyleSchema } from "./style";
import { isOpenApiSchema, type OpenApiSchema } from "../openapi";
/**
 * Web board: input schemas for web-platform properties.
 *
 * Schemas are grouped by platform so a property editor can recognize an
 * entire family at once: `WebInputSchema` is the union the editor switches
 * on to pick an input widget.
 */
export * from "./unit";
export * from "./size";
export * from "./keyValue";
export * from "./style";
export * from "../openapi";
/** Every input schema defined by the web board. */
export type WebInputSchema = UnitSchema | SizeSchema | KeyValueSchema | StyleSchema | OpenApiSchema;

/** Narrowing guard for any web-board input schema. */
export function isWebInputSchema(value: unknown): value is WebInputSchema {
  return (
    isUnitSchema(value) ||
    isSizeSchema(value) ||
    isKeyValueSchema(value) ||
    isStyleSchema(value) ||
    isOpenApiSchema(value)
  );
}
