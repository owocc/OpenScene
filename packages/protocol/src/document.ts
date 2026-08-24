import type { Spec, UIElement } from "@json-render/core";
import { z } from "zod";

export const SCENE_DOCUMENT_SCHEMA_VERSION = "1.0.0" as const;

export interface ScenePageInfo {
  title: string;
  description: string;
  keywords: string[];
  locale: string;
  metadata: Record<string, unknown>;
}

export interface SceneGlobalConfig {
  design?: unknown;
  body?: unknown;
  variables?: unknown;
  css?: unknown;
  i18n?: unknown;
  [key: string]: unknown;
}

export interface SceneDocument {
  schemaVersion: typeof SCENE_DOCUMENT_SCHEMA_VERSION;
  pageInfo: ScenePageInfo;
  globalConfig: SceneGlobalConfig;
  spec: Omit<Spec, "root"> & { root: string | null };
  [key: string]: unknown;
}

const nonEmptyString = z.string().min(1);
const unknownRecord = z.record(z.string(), z.unknown());

/**
 * JSON-render elements are kept in a flat identity map.  The map key is the
 * only persisted identity; adapters must not add an id to the element value.
 */
const UIElementSchema = z
  .object({
    type: nonEmptyString,
    props: unknownRecord,
    children: z.array(nonEmptyString).optional(),
    slots: z.record(nonEmptyString, z.array(nonEmptyString)).optional(),
    visible: z.unknown().optional(),
    on: z.record(nonEmptyString, z.unknown()).optional(),
    repeat: z.unknown().optional(),
    watch: z.record(nonEmptyString, z.unknown()).optional(),
  })
  .catchall(z.unknown());

const SpecSchema = z
  .object({
    // A new document has no root until the author adds the first node; the
    // runtime renders nothing until a root element is manually assigned.
    root: nonEmptyString.nullable(),
    elements: z.record(nonEmptyString, UIElementSchema),
    state: unknownRecord.optional(),
  })
  .catchall(z.unknown());

const PageInfoSchema = z
  .object({
    title: z.string(),
    description: z.string(),
    keywords: z.array(z.string()),
    locale: nonEmptyString,
    metadata: unknownRecord,
  })
  .catchall(z.unknown());

const GlobalConfigSchema = z
  .object({
    design: z.unknown().optional(),
    body: z.unknown().optional(),
    variables: z.unknown().optional(),
    css: z.unknown().optional(),
    i18n: z.unknown().optional(),
  })
  .catchall(z.unknown());

function hasKey(value: unknown, key: string, seen = new WeakSet<object>()): boolean {
  if (typeof value !== "object" || value === null) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasKey(item, key, seen));
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey === key || hasKey(entryValue, key, seen)) return true;
  }
  return false;
}

/**
 * Canonical page/document schema.  In addition to JSON-render's own flat
 * shape, this checks every child and named-slot edge before a document can be
 * persisted or sent over the bridge.
 */
export const SceneDocumentSchema: z.ZodType<SceneDocument> = z
  .object({
    schemaVersion: z.literal(SCENE_DOCUMENT_SCHEMA_VERSION),
    pageInfo: PageInfoSchema,
    globalConfig: GlobalConfigSchema,
    spec: SpecSchema,
  })
  .catchall(z.unknown())
  .superRefine((document, context) => {
    const { root, elements, state } = document.spec;
    if (root !== null && !(root in elements)) {
      context.addIssue({
        code: "custom",
        path: ["spec", "root"],
        message: `Root element "${root}" is not present in spec.elements`,
      });
    }

    for (const [nodeId, element] of Object.entries(elements) as Array<[string, UIElement]>) {
      const references = [
        ...(element.children ?? []),
        ...Object.values(element.slots ?? {}).flat(),
      ];
      for (const childId of references) {
        if (!(childId in elements)) {
          context.addIssue({
            code: "custom",
            path: ["spec", "elements", nodeId],
            message: `Element "${nodeId}" references missing element "${childId}"`,
          });
        }
      }
      if (Object.prototype.hasOwnProperty.call(element, "id")) {
        context.addIssue({
          code: "custom",
          path: ["spec", "elements", nodeId, "id"],
          message: "Element identity is represented by the spec.elements map key",
        });
      }
      if (hasKey(element.props, "__opensceneNodeId")) {
        context.addIssue({
          code: "custom",
          path: ["spec", "elements", nodeId, "props"],
          message: "Persisted props may not contain __opensceneNodeId",
        });
      }
    }

    if (state && Object.prototype.hasOwnProperty.call(state, "__scene")) {
      context.addIssue({
        code: "custom",
        path: ["spec", "state", "__scene"],
        message: "Persisted state may not contain the reserved __scene root",
      });
    }
  }) as z.ZodType<SceneDocument>;

export function createEmptySceneDocument(): SceneDocument {
  return {
    schemaVersion: SCENE_DOCUMENT_SCHEMA_VERSION,
    pageInfo: {
      title: "",
      description: "",
      keywords: [],
      locale: "en-US",
      metadata: {},
    },
    globalConfig: {},
    spec: {
      // No root node: the author adds the first element manually and it
      // becomes the root. The runtime renders nothing until then.
      root: null,
      elements: {},
      state: {},
    },
  };
}

export type { Spec, UIElement };
