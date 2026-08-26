import { APP_TYPE_WEB, type ComponentManifest, type SceneManifest } from "@openscene-ai/core";
import { z } from "zod";
import type {
  OpenSceneReactActionDefinition,
  OpenSceneReactComponentDefinition,
  OpenSceneReactCatalogOptions,
} from "./catalog.ts";

function schemaJson(schema: z.ZodType | undefined): Record<string, unknown> {
  if (!schema) return {};
  const converter = (z as unknown as { toJSONSchema?: (s: z.ZodType) => unknown }).toJSONSchema;
  if (typeof converter !== "function") return {};
  try {
    const result = converter(schema);
    if (result && typeof result === "object") return result as Record<string, unknown>;
  } catch {
    // Non-serializable zod extension: fallback
  }
  return {};
}

function componentManifest(definition: OpenSceneReactComponentDefinition): ComponentManifest {
  const propSchema = definition.schema ?? definition.props;
  return {
    title: definition.title,
    ...(definition.description === undefined ? {} : { description: definition.description }),
    ...(definition.category === undefined ? {} : { category: definition.category }),
    ...(definition.tags === undefined ? {} : { tags: definition.tags }),
    props: schemaJson(propSchema),
    ...(definition.editor === undefined ? {} : { editor: definition.editor }),
    ...(definition.events === undefined ? {} : { events: definition.events }),
    ...(definition.children === undefined ? {} : { children: definition.children }),
    ...(definition.slots === undefined
      ? {}
      : { slots: Object.fromEntries((definition.slots ?? []).map((slot) => [slot, {}])) }),
    ...(definition.capabilities === undefined ? {} : { capabilities: definition.capabilities }),
  };
}

function actionManifest(definition: OpenSceneReactActionDefinition): Record<string, unknown> {
  return {
    ...(definition.title === undefined ? {} : { title: definition.title }),
    ...(definition.description === undefined ? {} : { description: definition.description }),
    ...(definition.editor === undefined ? {} : { editor: definition.editor }),
    params: schemaJson(definition.params),
  };
}

export function View(): null {
  return null;
}
export function Text(): null {
  return null;
}
export function Button(): null {
  return null;
}
export function useOpenSceneNode(): { nodeId: null; nodeAttrs: Record<string, never> } {
  return { nodeId: null, nodeAttrs: {} };
}

const baseViewProps = {
  class: z.string().optional(),
  className: z.string().optional(),
  style: z
    .record(z.string(), z.unknown())
    .meta({ "x-editor": { control: "style", type: "style" } })
    .optional(),
};

export const baseReactComponents: Record<string, OpenSceneReactComponentDefinition> = {
  View: {
    type: "View",
    schema: z.object(baseViewProps).passthrough(),
    title: "View",
    description: "A layout container.",
    category: "layout",
    children: true,
  },
  Text: {
    type: "Text",
    schema: z
      .object({
        text: z.string().optional(),
        ...baseViewProps,
      })
      .passthrough(),
    title: "Text",
    description: "Text content.",
    category: "content",
    children: true,
  },
  Button: {
    type: "Button",
    schema: z
      .object({
        label: z.string().optional(),
        text: z.string().optional(),
        disabled: z.boolean().optional(),
        type: z.string().optional(),
        ...baseViewProps,
      })
      .passthrough(),
    title: "Button",
    description: "An interactive button.",
    category: "interactive",
    children: true,
    events: { press: { title: "Press" } },
  },
};

export const baseComponents = baseReactComponents;

export function defineOpenSceneReactComponent<
  P extends Record<string, unknown> = Record<string, unknown>,
>(definition: OpenSceneReactComponentDefinition<P>): OpenSceneReactComponentDefinition<P> {
  const namedSlots = (definition.slots ?? []).filter((slot) => slot.length > 0);
  if (namedSlots.length > 0) {
    throw new Error(
      `OpenScene React renderer does not support named slot "${namedSlots[0]}" on component "${definition.type}"`,
    );
  }
  return definition;
}

export function defineOpenSceneReactAction(
  definition: OpenSceneReactActionDefinition,
): OpenSceneReactActionDefinition {
  return definition;
}

export const defineOpenSceneComponent = defineOpenSceneReactComponent;
export const defineOpenSceneAction = defineOpenSceneReactAction;

export type {
  OpenSceneHandlerFactory,
  OpenSceneReactActionDefinition,
  OpenSceneReactComponentDefinition,
  OpenSceneReactCatalogOptions,
  ReactRenderer,
} from "./catalog.ts";

export function createOpenSceneManifest(options: OpenSceneReactCatalogOptions = {}): SceneManifest {
  const rawComponents = options.components
    ? Array.isArray(options.components)
      ? Object.fromEntries(options.components.map((item) => [item.type, item]))
      : options.components
    : {};
  const rawActions = options.actions
    ? Array.isArray(options.actions)
      ? Object.fromEntries(options.actions.map((item) => [item.key, item]))
      : options.actions
    : {};
  const components = { ...baseReactComponents, ...rawComponents };
  const appType = options.appType ?? APP_TYPE_WEB;
  return {
    protocolVersion: "2",
    appType,
    components: Object.fromEntries(
      Object.entries(components).map(([type, item]) => [type, componentManifest(item)]),
    ),
    ...(Object.keys(rawActions).length === 0
      ? {}
      : {
          actions: Object.fromEntries(
            Object.entries(rawActions).map(([key, item]) => [key, actionManifest(item)]),
          ),
        }),
  };
}
export {
  installOpenScene,
  OpenSceneController,
  createIndexedDbDraftStore,
  defineAppManifest,
  defineComponentManifest,
  directives,
  openSceneDirectives,
  pageDirective,
  translationDirective,
} from "@openscene-ai/javascript";
export type {
  DeepReadonly,
  DirectiveDefinition,
  OpenSceneClient,
  OpenSceneClientOptions,
  OpenSceneClientState,
  OpenSceneInteractionMode,
  OpenSceneStatus,
  SelectionReport,
} from "@openscene-ai/javascript";

export {
  APP_TYPE_WEB,
  APP_TYPE_REACT_NATIVE,
  APP_TYPE_FLUTTER,
  APP_TYPES,
  COMPONENT_DRAG_MIME,
} from "@openscene-ai/core";
export type { AppType } from "@openscene-ai/core";

export { openApiMethods, type OpenApiMethod, type OpenApiValue } from "@openscene-ai/schema";

export {
  SCENE_DOCUMENT_SCHEMA_VERSION,
  SceneDocumentSchema,
  createEmptySceneDocument,
  AppManifestSchema,
  ComponentManifestSchema,
  RuntimePageDeliverySchema,
} from "@openscene-ai/core";
export type {
  AppManifest,
  ComponentManifest,
  RuntimePageDelivery,
  SceneDocument,
  SceneGlobalConfig,
  ScenePageInfo,
  Spec,
  UIElement,
} from "@openscene-ai/core";

// ---------------------------------------------------------------------------
// OpenAPI request action — server/Node stubs
// These are imported by vite.config.ts at build time; only manifest metadata
// is needed on the server side; the actual fetch implementation runs in the
// browser bundle (catalog.ts).
// ---------------------------------------------------------------------------

import { openApiMethods, type OpenApiValue } from "@openscene-ai/schema";

/** Server stub — returns null; real implementation is in the browser bundle. */
export function buildOpenApiRequest(
  _value: OpenApiValue | undefined,
  _state: Record<string, unknown> = {},
): null {
  return null;
}

/** Server stub — always rejects; real implementation is in the browser bundle. */
export async function executeOpenApiRequest(_request: never): Promise<never> {
  throw new Error("executeOpenApiRequest is not available in a server/Node context");
}

/**
 * Server-side implementation of `defineOpenApiRequestAction`.
 * Generates the action manifest entry (key, title, description, params schema)
 * so `createManifest()` works correctly in vite.config.ts without a browser runtime.
 */
export function defineOpenApiRequestAction(options: {
  key: string;
  title?: string;
  description?: string;
}): OpenSceneReactActionDefinition {
  return defineOpenSceneReactAction({
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
    handler: () => {
      // No-op on server; real handler runs in the browser bundle.
    },
  });
}
