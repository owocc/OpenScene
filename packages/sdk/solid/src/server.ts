import { APP_TYPE_WEB, type AppType } from "@openscene-ai/constants";
import type { AppManifest, ComponentManifest } from "@openscene-ai/protocol";
import { z } from "zod";
import type {
  OpenSceneHandlerFactory,
  OpenSceneSolidActionDefinition,
  OpenSceneSolidApp,
  OpenSceneSolidComponentDefinition,
} from "./catalog.js";

function schemaJson(schema: z.ZodType | undefined): Record<string, unknown> {
  if (!schema) return {};
  const converter = (z as unknown as { toJSONSchema?: (value: z.ZodType) => unknown }).toJSONSchema;
  if (!converter) return {};
  try {
    const value = converter(schema);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function componentManifest(definition: OpenSceneSolidComponentDefinition): ComponentManifest {
  return {
    title: definition.title,
    ...(definition.description === undefined ? {} : { description: definition.description }),
    ...(definition.category === undefined ? {} : { category: definition.category }),
    ...(definition.tags === undefined ? {} : { tags: definition.tags }),
    props: schemaJson(definition.schema ?? definition.props),
    ...(definition.editor === undefined ? {} : { editor: definition.editor }),
    ...(definition.events === undefined ? {} : { events: definition.events }),
    ...(definition.children === undefined ? {} : { children: definition.children }),
    ...(definition.capabilities === undefined ? {} : { capabilities: definition.capabilities }),
  };
}

function actionManifest(definition: OpenSceneSolidActionDefinition): Record<string, unknown> {
  return {
    ...(definition.title === undefined ? {} : { title: definition.title }),
    ...(definition.description === undefined ? {} : { description: definition.description }),
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

export const baseSolidComponents: Record<string, OpenSceneSolidComponentDefinition> = {
  View: {
    type: "View",
    schema: z.object({}).passthrough(),
    title: "View",
    children: true,
    render: () => null,
  },
  Text: {
    type: "Text",
    schema: z.object({}).passthrough(),
    title: "Text",
    children: true,
    render: () => null,
  },
  Button: {
    type: "Button",
    schema: z.object({}).passthrough(),
    title: "Button",
    children: true,
    render: () => null,
  },
};

export function defineOpenSceneSolidComponent<
  P extends Record<string, unknown> = Record<string, unknown>,
>(definition: OpenSceneSolidComponentDefinition<P>): OpenSceneSolidComponentDefinition<P> {
  const slot = definition.slots?.find((value) => value.length > 0);
  if (slot)
    throw new Error(
      `OpenScene Solid renderer does not support named slot "${slot}" on component "${definition.type}"`,
    );
  return definition;
}

export function defineOpenSceneSolidAction(
  definition: OpenSceneSolidActionDefinition,
): OpenSceneSolidActionDefinition {
  return definition;
}

export type {
  DefineOpenSceneSolidAppOptions,
  OpenSceneHandlerFactory,
  OpenSceneSolidActionDefinition,
  OpenSceneSolidApp,
  OpenSceneSolidComponentDefinition,
  SolidRenderer,
} from "./catalog.js";

export function defineOpenSceneSolidApp(
  options: {
    appKey?: string;
    appType?: AppType;
    app?: { key: string; type?: AppType; [key: string]: unknown };
    components?:
      | OpenSceneSolidComponentDefinition[]
      | Record<string, OpenSceneSolidComponentDefinition>;
    actions?: OpenSceneSolidActionDefinition[] | Record<string, OpenSceneSolidActionDefinition>;
  } = {},
): OpenSceneSolidApp {
  const components = { ...baseSolidComponents } as Record<
    string,
    OpenSceneSolidComponentDefinition
  >;
  for (const definition of Array.isArray(options.components)
    ? options.components
    : Object.values(options.components ?? {}))
    components[definition.type] = definition;
  const actions = Object.fromEntries(
    (Array.isArray(options.actions) ? options.actions : Object.values(options.actions ?? {})).map(
      (definition) => [definition.key, definition],
    ),
  );
  const manifest: AppManifest = {
    protocolVersion: "2",
    app: {
      key: options.app?.key ?? options.appKey ?? "openscene-solid",
      type: options.app?.type ?? options.appType ?? APP_TYPE_WEB,
    },
    components: Object.fromEntries(
      Object.entries(components).map(([key, definition]) => [key, componentManifest(definition)]),
    ),
    ...(Object.keys(actions).length > 0
      ? {
          actions: Object.fromEntries(
            Object.entries(actions).map(([key, definition]) => [key, actionManifest(definition)]),
          ),
        }
      : {}),
  };
  const handlers: OpenSceneHandlerFactory = () => ({});
  return {
    appType: manifest.app.type,
    catalog: { componentNames: Object.keys(components), actionNames: Object.keys(actions) },
    registry: {},
    handlers,
    componentDefinitions: components,
    actionDefinitions: actions,
    manifest,
  } as OpenSceneSolidApp;
}
