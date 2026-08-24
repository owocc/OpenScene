import { isSizeSchema, type SizeSchema } from "./size.js";
import { isUnitSchema, type UnitSchema } from "./unit.js";
import { isOpenApiSchema, type OpenApiSchema } from "../openapi.js";
/**
 * Web board: input schemas for web-platform properties.
 *
 * Schemas are grouped by platform so a property editor can recognize an
 * entire family at once: `WebInputSchema` is the union the editor switches
 * on to pick an input widget.
 */
export * from "./unit.js";
export * from "./size.js";
export * from "../openapi.js";
/** Every input schema defined by the web board. */
export type WebInputSchema = UnitSchema | SizeSchema | OpenApiSchema;

/** Narrowing guard for any web-board input schema. */
export function isWebInputSchema(value: unknown): value is WebInputSchema {
  return isUnitSchema(value) || isSizeSchema(value) || isOpenApiSchema(value);
}
