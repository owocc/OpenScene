import { APP_TYPE_WEB, type AppType } from "@openscene/constants";
import type { AppManifest, ComponentManifest } from "@openscene/protocol";
import { z } from "zod";
import type {
  OpenSceneHandlerFactory,
  OpenSceneReactActionDefinition,
  OpenSceneReactApp,
  OpenSceneReactComponentDefinition,
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
  DefineOpenSceneReactAppOptions,
  OpenSceneHandlerFactory,
  OpenSceneReactActionDefinition,
  OpenSceneReactApp,
  OpenSceneReactComponentDefinition,
  ReactRenderer,
} from "./catalog.ts";

export function defineOpenSceneReactApp(
  options: {
    appKey?: string;
    appType?: AppType;
    app?: { key: string; type?: AppType; [key: string]: unknown };
    components?:
      | OpenSceneReactComponentDefinition<any>[]
      | Record<string, OpenSceneReactComponentDefinition<any>>;
    actions?: OpenSceneReactActionDefinition[] | Record<string, OpenSceneReactActionDefinition>;
  } = {},
): OpenSceneReactApp {
  const appKey = options.app?.key ?? options.appKey ?? "openscene-react";
  const appType = options.app?.type ?? options.appType ?? APP_TYPE_WEB;
  const rawComponents = options.components
    ? Array.isArray(options.components)
      ? Object.fromEntries(options.components.map((item) => [item.type, item]))
      : options.components
    : {};
  const components = { ...baseReactComponents, ...rawComponents };
  const rawActions = options.actions
    ? Array.isArray(options.actions)
      ? Object.fromEntries(options.actions.map((item) => [item.key, item]))
      : options.actions
    : {};
  const manifest: AppManifest = {
    protocolVersion: "2",
    app: { key: appKey, type: appType },
    components: Object.fromEntries(
      Object.entries(components).map(([type, item]) => [type, componentManifest(item)]),
    ),
    actions: Object.fromEntries(
      Object.entries(rawActions).map(([key, item]) => [key, actionManifest(item)]),
    ),
  };
  return {
    appType,
    catalog: {
      data: { components: {}, actions: {} },
      validate: () => ({ success: true, data: undefined as never }),
      componentNames: Object.keys(components),
      actionNames: Object.keys(rawActions),
    } as unknown as OpenSceneReactApp["catalog"],
    registry: {},
    handlers: (() => ({})) as OpenSceneHandlerFactory,
    componentDefinitions: components,
    actionDefinitions: rawActions,
    manifest,
  };
}

export const defineOpenSceneApp = defineOpenSceneReactApp;
