import { isInputSchemaBase, type InputSchemaBase, type JsonValue } from "./schema.js";

/**
 * HTTP methods an OpenAPI operation can declare. Lowercase to match the
 * `pathItem` keys of an OpenAPI 3.x document.
 */
export const openApiMethods = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

export type OpenApiMethod = (typeof openApiMethods)[number];

/**
 * Request parameters for the selected operation. `path` maps path-parameter
 * names to their values (substituted into `{name}` placeholders); `query`
 * holds query parameters; `body` is the request body as JSON.
 */
export type OpenApiRequestParams = {
  path?: Record<string, string>;
  query?: Record<string, JsonValue>;
  body?: JsonValue;
};

/**
 * The value a property backed by an `OpenApiSchema` holds: the full OpenAPI
 * document (self-contained snapshot), the selected operation path and
 * method, and the parameters to send.
 */
export type OpenApiValue = {
  /** Full OpenAPI 3.x document; `json.servers[0].url` is the base URL. */
  json: Record<string, JsonValue>;
  /** Selected operation path template, e.g. `/users/{userId}`. */
  path: string;
  method: OpenApiMethod;
  params?: OpenApiRequestParams;
};

/**
 * Input schema for OpenAPI-backed properties: the property editor renders a
 * document/operation picker and a parameter form instead of a plain JSON
 * editor.
 */
export interface OpenApiSchema extends InputSchemaBase<"openapi"> {
  type: "openapi";
  /** HTTP methods the editor may pick; defaults to `openApiMethods`. */
  methods?: readonly OpenApiMethod[];
}

export interface OpenApiSchemaInput {
  title?: string;
  description?: string;
  placeholder?: string;
  default?: OpenApiValue;
  required?: boolean;
  control?: string;
  methods?: readonly OpenApiMethod[];
}

/** Builds an openapi schema, defaulting the selectable methods to `openApiMethods`. */
export function openApiSchema(input: OpenApiSchemaInput = {}): OpenApiSchema {
  const { methods, ...rest } = input;
  return { type: "openapi", methods: [...(methods ?? openApiMethods)], ...rest };
}

/** Narrowing guard for `OpenApiSchema`. */
export function isOpenApiSchema(value: unknown): value is OpenApiSchema {
  return (
    isInputSchemaBase(value) &&
    (value as OpenApiSchema).type === "openapi" &&
    Array.isArray((value as OpenApiSchema).methods)
  );
}
