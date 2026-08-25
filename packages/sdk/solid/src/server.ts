import { APP_TYPE_WEB, type AppType } from "@openscene-ai/constants";
import type { AppManifest, ComponentManifest } from "@openscene-ai/protocol";
import { openApiMethods } from "@openscene-ai/schema";
import type { OpenApiValue } from "@openscene-ai/schema";
import { z } from "zod";
import type {
  DefineOpenSceneSolidAppOptions,
  OpenSceneSolidActionDefinition,
  OpenSceneSolidApp,
  OpenSceneSolidComponentDefinition,
} from "./catalog.ts";

// ---------------------------------------------------------------------------
// Server / Node stubs
// Loaded by vite.config.ts via the "node" export condition.
// Only manifest-generation code runs in this context; no Solid rendering.
// ---------------------------------------------------------------------------

export function View(): null {
  return null;
}
export function Text(): null {
  return null;
}
export function Button(): null {
  return null;
}
export function useOpenSceneNode() {
  return { nodeId: null, nodeAttrs: {} };
}
const baseComponentSchema = z.object({}).passthrough();

/** Serializable primitive metadata for manifest generation in Node contexts. */
export const baseSolidComponents = {
  View: {
    type: "View",
    schema: baseComponentSchema,
    title: "View",
    description: "Layout container.",
    category: "layout",
    children: true,
  },
  Text: {
    type: "Text",
    schema: baseComponentSchema,
    title: "Text",
    description: "Text node.",
    category: "basic",
  },
  Button: {
    type: "Button",
    schema: baseComponentSchema,
    title: "Button",
    description: "Clickable button.",
    category: "basic",
  },
};
export const baseComponents = baseSolidComponents;

function zodJsonSchema(value: z.ZodType): Record<string, unknown> {
  const converter = (z as unknown as { toJSONSchema?: (s: z.ZodType) => unknown }).toJSONSchema;
  if (typeof converter !== "function") return {};
  try {
    const result = converter(value);
    if (result && typeof result === "object") return result as Record<string, unknown>;
  } catch {
    // ignore
  }
  return {};
}

function componentManifestEntry(def: OpenSceneSolidComponentDefinition): Record<string, unknown> {
  const schema = def.schema ?? def.props;
  return {
    title: def.title,
    ...(def.description !== undefined && { description: def.description }),
    ...(def.category !== undefined && { category: def.category }),
    ...(def.tags !== undefined && { tags: def.tags }),
    props: schema ? zodJsonSchema(schema) : {},
    ...(def.editor !== undefined && { editor: def.editor }),
    ...(def.events !== undefined && { events: def.events }),
    ...(def.children !== undefined && { children: def.children }),
    ...(def.slots !== undefined && {
      slots: Object.fromEntries(def.slots.map((s) => [s, {}])),
    }),
    ...(def.capabilities !== undefined && { capabilities: def.capabilities }),
  };
}

function actionManifestEntry(def: OpenSceneSolidActionDefinition): Record<string, unknown> {
  return {
    ...(def.title !== undefined && { title: def.title }),
    ...(def.description !== undefined && { description: def.description }),
    ...(def.editor !== undefined && { editor: def.editor }),
    params: def.params ? zodJsonSchema(def.params) : {},
  };
}

export function defineOpenSceneSolidComponent<
  P extends Record<string, unknown> = Record<string, unknown>,
>(definition: OpenSceneSolidComponentDefinition<P>): OpenSceneSolidComponentDefinition<P> {
  return definition;
}

export function defineOpenSceneSolidAction(
  definition: OpenSceneSolidActionDefinition,
): OpenSceneSolidActionDefinition {
  return definition;
}

export const defineOpenSceneComponent = defineOpenSceneSolidComponent;
export const defineOpenSceneAction = defineOpenSceneSolidAction;

export function defineOpenSceneSolidApp(
  options: DefineOpenSceneSolidAppOptions = {},
): OpenSceneSolidApp {
  const appKey = options.app?.key ?? options.appKey ?? "openscene-solid";
  const appType: AppType = options.app?.type ?? options.appType ?? APP_TYPE_WEB;

  const rawComponents: Record<string, OpenSceneSolidComponentDefinition> = options.components
    ? Array.isArray(options.components)
      ? Object.fromEntries(options.components.map((d) => [d.type, d]))
      : options.components
    : {};

  const rawActions: Record<string, OpenSceneSolidActionDefinition> = options.actions
    ? Array.isArray(options.actions)
      ? Object.fromEntries(options.actions.map((d) => [d.key, d]))
      : options.actions
    : {};

  const manifest: AppManifest = {
    protocolVersion: "2",
    app: { key: appKey, type: appType },
    components: Object.fromEntries(
      Object.entries(rawComponents).map(([type, def]) => [type, componentManifestEntry(def)]),
    ) as Record<string, ComponentManifest>,
    ...(Object.keys(rawActions).length > 0 && {
      actions: Object.fromEntries(
        Object.entries(rawActions).map(([key, def]) => [key, actionManifestEntry(def)]),
      ),
    }),
  };

  return {
    appType,
    registry: {},
    actionDefinitions: rawActions,
    componentDefinitions: rawComponents,
    manifest,
  };
}

export const defineOpenSceneApp = defineOpenSceneSolidApp;

// Server stubs for OpenAPI utilities.
export function buildOpenApiRequest(_value: OpenApiValue | undefined): null {
  return null;
}

export async function executeOpenApiRequest(_request: never): Promise<never> {
  throw new Error("executeOpenApiRequest is not available in server context");
}

export function defineOpenApiRequestAction(options: {
  key: string;
  title?: string;
  description?: string;
}): OpenSceneSolidActionDefinition {
  return defineOpenSceneSolidAction({
    key: options.key,
    title: options.title ?? options.key,
    description: options.description ?? "Execute an OpenAPI request.",
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
    handler: () => {},
  });
}

export { openApiMethods, type OpenApiMethod, type OpenApiValue } from "@openscene-ai/schema";

export {
  SCENE_DOCUMENT_SCHEMA_VERSION,
  SceneDocumentSchema,
  createEmptySceneDocument,
  AppManifestSchema,
  ComponentManifestSchema,
  RuntimePageDeliverySchema,
} from "@openscene-ai/protocol";
export type {
  AppManifest,
  ComponentManifest,
  RuntimePageDelivery,
  SceneDocument,
  SceneGlobalConfig,
  ScenePageInfo,
  Spec,
  UIElement,
} from "@openscene-ai/protocol";

export {
  APP_TYPE_WEB,
  APP_TYPE_FLUTTER,
  APP_TYPE_REACT_NATIVE,
  APP_TYPES,
} from "@openscene-ai/constants";
export type { AppType } from "@openscene-ai/constants";

export {
  installOpenScene,
  OpenSceneController,
  createIndexedDbDraftStore,
  defineAppManifest,
  defineComponentManifest,
} from "@openscene-ai/javascript";
export type {
  DeepReadonly,
  OpenSceneClient,
  OpenSceneClientOptions,
  OpenSceneClientState,
  OpenSceneInteractionMode,
  OpenSceneStatus,
  SelectionReport,
} from "@openscene-ai/javascript";
