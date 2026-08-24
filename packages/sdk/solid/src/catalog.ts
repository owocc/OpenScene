import { defineCatalog, type Catalog } from "@json-render/core";
import { schema } from "@json-render/solid/schema";
import { APP_TYPE_WEB, type AppType } from "@openscene/constants";
import type { AppManifest, ComponentManifest } from "@openscene/protocol";
import { z } from "zod";
import type { JSX } from "solid-js";
import type { ComponentRenderProps } from "@json-render/solid";
import { defineRegistry as defineRegistryUntyped } from "@json-render/solid";
import { Button, Text, View } from "./node.js";

const defineRegistry = defineRegistryUntyped;

type RegistryResult = {
  registry: Record<string, unknown>;
  handlers: unknown;
};

function createRegistry(catalog: Catalog, options: Record<string, unknown>): RegistryResult {
  return defineRegistry(catalog, options) as RegistryResult;
}

function mergeComponentDefinitions(
  custom:
    | OpenSceneSolidComponentDefinition[]
    | Record<string, OpenSceneSolidComponentDefinition>
    | undefined,
): Record<string, OpenSceneSolidComponentDefinition> {
  if (!custom) return { ...baseSolidComponents };
  if (Array.isArray(custom)) {
    return {
      ...baseSolidComponents,
      ...Object.fromEntries(custom.map((definition) => [definition.type, definition])),
    };
  }
  return { ...baseSolidComponents, ...custom };
}

function mergeActionDefinitions(
  custom:
    | OpenSceneSolidActionDefinition[]
    | Record<string, OpenSceneSolidActionDefinition>
    | undefined,
): Record<string, OpenSceneSolidActionDefinition> {
  if (!custom) return { ...baseSolidActions };
  if (Array.isArray(custom)) {
    return {
      ...baseSolidActions,
      ...Object.fromEntries(custom.map((definition) => [definition.key, definition])),
    };
  }
  return { ...baseSolidActions, ...custom };
}

export type SolidRenderer<P = Record<string, unknown>> = (
  props: ComponentRenderProps<P>,
) => JSX.Element;

export interface OpenSceneSolidComponentDefinition<
  P extends Record<string, unknown> = Record<string, unknown>,
> {
  type: string;
  /** Zod props schema. `props` is accepted as an alias for schema. */
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
  /** Solid renderer. `renderer` is accepted as an alias for render. */
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
export type OpenSceneHandlerFactory = (
  getSetState: () =>
    | ((updater: (previous: Record<string, unknown>) => Record<string, unknown>) => void)
    | undefined,
  getState: () => Record<string, unknown>,
) => Record<string, (params: Record<string, unknown>) => Promise<void>>;

export interface OpenSceneSolidApp {
  readonly appType: AppType;
  readonly catalog: Catalog;
  readonly registry: Record<string, unknown>;
  readonly handlers: OpenSceneHandlerFactory;
  readonly componentDefinitions: Record<string, OpenSceneSolidComponentDefinition>;
  readonly actionDefinitions: Record<string, OpenSceneSolidActionDefinition>;
  readonly manifest: AppManifest;
}

function zodJsonSchema(value: z.ZodType): Record<string, unknown> {
  const converter = (z as unknown as { toJSONSchema?: (schema: z.ZodType) => unknown })
    .toJSONSchema;
  if (typeof converter !== "function") return {};
  try {
    const result = converter(value);
    if (result && typeof result === "object") return result as Record<string, unknown>;
  } catch {
    // A manifest must still be serializable when a non-JSON-compatible Zod extension is used.
  }
  return {};
}

function normalizeComponents(
  values: OpenSceneSolidComponentDefinition[] | Record<string, OpenSceneSolidComponentDefinition>,
): Record<string, OpenSceneSolidComponentDefinition> {
  const entries = Array.isArray(values)
    ? values.map((value) => [value.type, value] as const)
    : Object.entries(values);
  const result: Record<string, OpenSceneSolidComponentDefinition> = {};
  for (const [type, definition] of entries) {
    if (!definition || definition.type !== type) {
      throw new Error(`OpenScene Solid component key "${type}" does not match its type`);
    }
    const propSchema = definition.schema ?? definition.props;
    if (!propSchema) throw new Error(`OpenScene Solid component "${type}" requires a props schema`);
    if (!(definition.render ?? definition.renderer)) {
      throw new Error(`OpenScene Solid component "${type}" requires a renderer`);
    }
    const namedSlots = (definition.slots ?? []).filter((slot) => slot.length > 0);
    if (namedSlots.length > 0) {
      throw new Error(
        `OpenScene Solid renderer does not support named slot "${namedSlots[0]}" on component "${type}"`,
      );
    }
    result[type] = definition;
  }
  return result;
}

function normalizeActions(
  values:
    | OpenSceneSolidActionDefinition[]
    | Record<string, OpenSceneSolidActionDefinition>
    | undefined,
): Record<string, OpenSceneSolidActionDefinition> {
  if (!values) return {};
  const entries = Array.isArray(values)
    ? values.map((value) => [value.key, value] as const)
    : Object.entries(values);
  const result: Record<string, OpenSceneSolidActionDefinition> = {};
  for (const [key, definition] of entries) {
    if (!definition || definition.key !== key) {
      throw new Error(`OpenScene Solid action key "${key}" does not match its key`);
    }
    if (!definition.handler) throw new Error(`OpenScene Solid action "${key}" requires a handler`);
    result[key] = definition;
  }
  return result;
}

export function defineOpenSceneSolidComponent<
  P extends Record<string, unknown> = Record<string, unknown>,
>(definition: OpenSceneSolidComponentDefinition<P>): OpenSceneSolidComponentDefinition<P> {
  const components = normalizeComponents({
    [definition.type]: definition as unknown as OpenSceneSolidComponentDefinition,
  });
  return components[definition.type] as OpenSceneSolidComponentDefinition<P>;
}

export function defineOpenSceneSolidAction(
  definition: OpenSceneSolidActionDefinition,
): OpenSceneSolidActionDefinition {
  return normalizeActions({ [definition.key]: definition })[definition.key];
}

function createManifest(
  appKey: string,
  appType: AppType,
  components: Record<string, OpenSceneSolidComponentDefinition>,
  actions: Record<string, OpenSceneSolidActionDefinition>,
): AppManifest {
  const componentManifest: Record<string, ComponentManifest> = {};
  for (const [type, definition] of Object.entries(components)) {
    const propSchema = definition.schema ?? definition.props;
    if (!propSchema) throw new Error(`OpenScene Solid component "${type}" requires a props schema`);
    componentManifest[type] = {
      title: definition.title,
      ...(definition.description === undefined ? {} : { description: definition.description }),
      ...(definition.category === undefined ? {} : { category: definition.category }),
      ...(definition.tags === undefined ? {} : { tags: definition.tags }),
      props: zodJsonSchema(propSchema),
      ...(definition.editor === undefined ? {} : { editor: definition.editor }),
      ...(definition.events === undefined ? {} : { events: definition.events }),
      ...(definition.children === undefined ? {} : { children: definition.children }),
      ...(definition.slots === undefined
        ? {}
        : { slots: Object.fromEntries((definition.slots ?? []).map((slot) => [slot, {}])) }),
      ...(definition.capabilities === undefined ? {} : { capabilities: definition.capabilities }),
    };
  }
  const actionManifest: Record<string, unknown> = {};
  for (const [key, definition] of Object.entries(actions)) {
    actionManifest[key] = {
      ...(definition.title === undefined ? {} : { title: definition.title }),
      ...(definition.description === undefined ? {} : { description: definition.description }),
      ...(definition.editor === undefined ? {} : { editor: definition.editor }),
      params: definition.params ? zodJsonSchema(definition.params) : {},
    };
  }
  return {
    protocolVersion: "2",
    app: { key: appKey, type: appType },
    components: componentManifest,
    ...(Object.keys(actionManifest).length === 0 ? {} : { actions: actionManifest }),
  };
}

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
  const components = normalizeComponents(mergeComponentDefinitions(options.components));
  const actions = normalizeActions(mergeActionDefinitions(options.actions));
  const catalogData = {
    components: Object.fromEntries(
      Object.entries(components).map(([type, definition]) => [
        type,
        {
          props: definition.schema ?? definition.props ?? z.object({}),
          slots: ["default"],
          description: definition.description ?? definition.title,
        },
      ]),
    ),
    actions: Object.fromEntries(
      Object.entries(actions).map(([key, definition]) => [
        key,
        {
          params: definition.params ?? z.object({}),
          description: definition.description ?? definition.title ?? key,
        },
      ]),
    ),
  };
  const catalog = defineCatalog(schema, catalogData as never);
  const componentFns = Object.fromEntries(
    Object.entries(components).map(([type, definition]) => [
      type,
      definition.render ?? definition.renderer,
    ]),
  );
  const actionFns = Object.fromEntries(
    Object.entries(actions).map(([key, definition]) => [key, definition.handler]),
  );
  const registryResult =
    Object.keys(actions).length > 0
      ? createRegistry(catalog, { components: componentFns, actions: actionFns })
      : createRegistry(catalog, { components: componentFns });
  const manifest = createManifest(appKey, appType, components, actions);
  return {
    appType,
    catalog,
    registry: registryResult.registry,
    handlers: registryResult.handlers as OpenSceneHandlerFactory,
    componentDefinitions: components,
    actionDefinitions: actions,
    manifest,
  };
}

const viewSchema = z
  .object({
    class: z.string().optional(),
    className: z.string().optional(),
    style: z
      .record(z.string(), z.unknown())
      .meta({ "x-editor": { control: "style", type: "style" } })
      .optional(),
  })
  .passthrough();
const textSchema = z
  .object({
    text: z.string().optional(),
    class: z.string().optional(),
    className: z.string().optional(),
    style: z
      .record(z.string(), z.unknown())
      .meta({ "x-editor": { control: "style", type: "style" } })
      .optional(),
  })
  .passthrough();
const buttonSchema = z
  .object({
    label: z.string().optional(),
    text: z.string().optional(),
    disabled: z.boolean().optional(),
    type: z.string().optional(),
    class: z.string().optional(),
    className: z.string().optional(),
    style: z
      .record(z.string(), z.unknown())
      .meta({ "x-editor": { control: "style", type: "style" } })
      .optional(),
  })
  .passthrough();
export const baseSolidComponents: Record<string, OpenSceneSolidComponentDefinition> = {
  View: {
    type: "View",
    schema: viewSchema,
    title: "View",
    description: "A layout container.",
    category: "layout",
    children: true,
    render: View as unknown as SolidRenderer,
  },
  Text: {
    type: "Text",
    schema: textSchema,
    title: "Text",
    description: "Text content.",
    category: "content",
    children: true,
    render: Text as unknown as SolidRenderer,
  },
  Button: {
    type: "Button",
    schema: buttonSchema,
    title: "Button",
    description: "An interactive button.",
    category: "interactive",
    children: true,
    events: { press: { title: "Press" } },
    render: Button as unknown as SolidRenderer,
  },
};

export const baseSolidActions: Record<string, OpenSceneSolidActionDefinition> = {
  setState: {
    key: "setState",
    title: "Set State",
    description: "Update state values",
    params: z.record(z.string(), z.unknown()),
    handler: (params, setState) => {
      if (!params) return;
      setState((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(params)) {
          if (v === "__toggle__" || v === "!current") {
            next[k] = !prev[k];
          } else {
            next[k] = v;
          }
        }
        return next;
      });
    },
  },
};
