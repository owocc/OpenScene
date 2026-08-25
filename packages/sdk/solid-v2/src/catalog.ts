import { APP_TYPE_WEB, type AppType } from "@openscene-ai/constants";
import { evaluateDynamicValue } from "@openscene-ai/javascript";
import type { AppManifest, ComponentManifest } from "@openscene-ai/protocol";
import { openApiMethods, type OpenApiValue } from "@openscene-ai/schema";
import type { JSX } from "@solidjs/web";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Renderer type
// ---------------------------------------------------------------------------

/**
 * A Solid component that renders a scene element.
 * Receives resolved props (dynamic bindings already evaluated) plus children.
 */
export type SolidRenderer<P = Record<string, unknown>> = (
  props: P & { children?: JSX.Element },
) => JSX.Element;

// ---------------------------------------------------------------------------
// Definition interfaces
// ---------------------------------------------------------------------------

export interface OpenSceneSolidComponentDefinition<
  P extends Record<string, unknown> = Record<string, unknown>,
> {
  type: string;
  /** Zod schema for props. `props` is an alias. */
  schema?: z.ZodType<P>;
  props?: z.ZodType<P>;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  editor?: Record<string, unknown>;
  events?: Record<string, unknown>;
  children?: unknown;
  slots?: readonly string[];
  capabilities?: Record<string, unknown>;
  /** Solid renderer function. `renderer` is an alias. */
  render?: SolidRenderer<P>;
  renderer?: SolidRenderer<P>;
}

export interface OpenSceneSolidActionDefinition {
  key: string;
  params?: z.ZodType<Record<string, unknown>>;
  title?: string;
  description?: string;
  editor?: Record<string, unknown>;
  handler: (
    params: Record<string, unknown> | undefined,
    setState: (updater: (previous: Record<string, unknown>) => Record<string, unknown>) => void,
    state: Record<string, unknown>,
  ) => Promise<void> | void;
}

export interface OpenSceneSolidApp {
  readonly appType: AppType;
  /** type → Solid component function */
  readonly registry: Record<string, SolidRenderer>;
  /** key → action handler factory (needs setState injected by provider) */
  readonly actionDefinitions: Record<string, OpenSceneSolidActionDefinition>;
  readonly componentDefinitions: Record<string, OpenSceneSolidComponentDefinition>;
  readonly manifest: AppManifest;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function zodJsonSchema(value: z.ZodType): Record<string, unknown> {
  const converter = (z as unknown as { toJSONSchema?: (s: z.ZodType) => unknown }).toJSONSchema;
  if (typeof converter !== "function") return {};
  try {
    const result = converter(value);
    if (result && typeof result === "object") return result as Record<string, unknown>;
  } catch {
    // schema not serializable – return empty
  }
  return {};
}

function mergeComponents(
  input:
    | OpenSceneSolidComponentDefinition<any>[]
    | Record<string, OpenSceneSolidComponentDefinition<any>>
    | undefined,
): Record<string, OpenSceneSolidComponentDefinition> {
  if (!input) return {};
  if (Array.isArray(input)) return Object.fromEntries(input.map((d) => [d.type, d]));
  return { ...input };
}

function mergeActions(
  input:
    | OpenSceneSolidActionDefinition[]
    | Record<string, OpenSceneSolidActionDefinition>
    | undefined,
): Record<string, OpenSceneSolidActionDefinition> {
  if (!input) return {};
  if (Array.isArray(input)) return Object.fromEntries(input.map((d) => [d.key, d]));
  return { ...input };
}

function buildManifest(
  appKey: string,
  appType: AppType,
  components: Record<string, OpenSceneSolidComponentDefinition<any>>,
  actions: Record<string, OpenSceneSolidActionDefinition>,
): AppManifest {
  const componentManifest: Record<string, ComponentManifest> = {};
  for (const [type, def] of Object.entries(components)) {
    const schema = def.schema ?? def.props;
    if (!schema) throw new Error(`OpenScene Solid component "${type}" requires a schema`);
    componentManifest[type] = {
      title: def.title,
      ...(def.description !== undefined && { description: def.description }),
      ...(def.category !== undefined && { category: def.category }),
      ...(def.tags !== undefined && { tags: def.tags }),
      props: zodJsonSchema(schema),
      ...(def.editor !== undefined && { editor: def.editor }),
      ...(def.events !== undefined && { events: def.events }),
      ...(def.children !== undefined && { children: def.children }),
      ...(def.slots !== undefined && {
        slots: Object.fromEntries(def.slots.map((s) => [s, {}])),
      }),
      ...(def.capabilities !== undefined && { capabilities: def.capabilities }),
    };
  }
  const actionManifest: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(actions)) {
    actionManifest[key] = {
      ...(def.title !== undefined && { title: def.title }),
      ...(def.description !== undefined && { description: def.description }),
      ...(def.editor !== undefined && { editor: def.editor }),
      params: def.params ? zodJsonSchema(def.params) : {},
    };
  }
  return {
    protocolVersion: "2",
    app: { key: appKey, type: appType },
    components: componentManifest,
    ...(Object.keys(actionManifest).length > 0 && { actions: actionManifest }),
  };
}

// ---------------------------------------------------------------------------
// Public factory functions
// ---------------------------------------------------------------------------

export function defineOpenSceneSolidComponent<
  P extends Record<string, unknown> = Record<string, unknown>,
>(definition: OpenSceneSolidComponentDefinition<P>): OpenSceneSolidComponentDefinition<P> {
  if (!(definition.schema ?? definition.props)) {
    throw new Error(`OpenScene Solid component "${definition.type}" requires a schema`);
  }
  return definition;
}

export function defineOpenSceneSolidAction(
  definition: OpenSceneSolidActionDefinition,
): OpenSceneSolidActionDefinition {
  if (!definition.handler) {
    throw new Error(`OpenScene Solid action "${definition.key}" requires a handler`);
  }
  return definition;
}

export const defineOpenSceneComponent = defineOpenSceneSolidComponent;
export const defineOpenSceneAction = defineOpenSceneSolidAction;

export interface DefineOpenSceneSolidAppOptions {
  appKey?: string;
  appType?: AppType;
  app?: { key: string; type?: AppType; [key: string]: unknown };
  components?:
    | OpenSceneSolidComponentDefinition<any>[]
    | Record<string, OpenSceneSolidComponentDefinition<any>>;
  actions?: OpenSceneSolidActionDefinition[] | Record<string, OpenSceneSolidActionDefinition>;
}

export function defineOpenSceneSolidApp(
  options: DefineOpenSceneSolidAppOptions = {},
): OpenSceneSolidApp {
  const appKey = options.app?.key ?? options.appKey ?? "openscene-solid";
  const appType = options.app?.type ?? options.appType ?? APP_TYPE_WEB;
  const components = mergeComponents(options.components);
  const actions = mergeActions(options.actions);

  const registry: Record<string, SolidRenderer> = {};
  for (const [type, def] of Object.entries(components)) {
    const fn = def.render ?? def.renderer;
    if (fn) registry[type] = fn as SolidRenderer;
  }

  const manifest = buildManifest(appKey, appType, components, actions);
  return {
    appType,
    registry,
    actionDefinitions: actions,
    componentDefinitions: components,
    manifest,
  };
}

export const defineOpenSceneApp = defineOpenSceneSolidApp;

// ---------------------------------------------------------------------------
// OpenAPI request utilities (framework-agnostic, same as React SDK)
// ---------------------------------------------------------------------------

export interface OpenApiRequest {
  url: string;
  method: string;
  body?: unknown;
  headers: Record<string, string>;
}

export function buildOpenApiRequest(
  value: OpenApiValue | undefined,
  state: Record<string, unknown> = {},
): OpenApiRequest | null {
  if (!value?.json || !value.path || !value.method) return null;

  const rawServers = value.json["servers"] as unknown;
  const serverList = Array.isArray(rawServers) ? rawServers : [];
  const base = typeof serverList[0]?.url === "string" ? serverList[0].url.replace(/\/+$/, "") : "";
  let path = value.path;

  const params = evaluateDynamicValue(value.params ?? {}, state) as {
    path?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: unknown;
  };

  // Path params
  if (params.path) {
    for (const [name, val] of Object.entries(params.path)) {
      path = path.replace(`{${name}}`, encodeURIComponent(String(val)));
    }
  }

  // Query params
  const stringifyQueryValue = (queryValue: unknown) => {
    if (
      typeof queryValue === "string" ||
      typeof queryValue === "number" ||
      typeof queryValue === "boolean" ||
      typeof queryValue === "bigint"
    ) {
      return String(queryValue);
    }
    return JSON.stringify(queryValue) ?? "";
  };

  const searchParams = new URLSearchParams();
  if (params.query) {
    for (const [k, v] of Object.entries(params.query)) {
      if (v !== undefined && v !== null) searchParams.set(k, stringifyQueryValue(v));
    }
  }
  const qs = searchParams.toString();
  const url = `${base}${path}${qs ? `?${qs}` : ""}`;

  return {
    url,
    method: value.method,
    body: params.body,
    headers: { "Content-Type": "application/json" },
  };
}

export async function executeOpenApiRequest(request: OpenApiRequest): Promise<unknown> {
  const hasBody =
    request.body !== undefined && !["GET", "HEAD"].includes(request.method.toUpperCase());
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    ...(hasBody && { body: JSON.stringify(request.body) }),
  });
  if (!response.ok) throw new Error(`${request.method} ${request.url} → ${response.status}`);
  return response.json();
}

export function defineOpenApiRequestAction(options: {
  key: string;
  title?: string;
  description?: string;
}): OpenSceneSolidActionDefinition {
  return defineOpenSceneSolidAction({
    key: options.key,
    title: options.title ?? options.key,
    description:
      options.description ??
      "Execute an OpenAPI request. Configure the endpoint in Studio via the openapi prop control.",
    params: z.object({
      openapi: z
        .object({
          json: z.record(z.string(), z.unknown()),
          path: z.string(),
          method: z.enum([...openApiMethods]),
          params: z
            .object({
              path: z.record(z.string(), z.unknown()).optional(),
              query: z.record(z.string(), z.unknown()).optional(),
              body: z.unknown().optional(),
            })
            .optional(),
        })
        .meta({ "x-editor": { control: "openapi" } })
        .optional(),
      resultKey: z.string().optional(),
      errorKey: z.string().optional(),
    }),
    handler: async (params, setState, state) => {
      const request = buildOpenApiRequest(params?.["openapi"] as OpenApiValue | undefined, state);
      if (!request) return;
      try {
        const result = await executeOpenApiRequest(request);
        const resultKey = params?.["resultKey"] as string | undefined;
        if (resultKey) setState((prev) => ({ ...prev, [resultKey]: result }));
      } catch (err) {
        const errorKey = params?.["errorKey"] as string | undefined;
        if (errorKey) setState((prev) => ({ ...prev, [errorKey]: String(err) }));
      }
    },
  });
}
