import { APP_TYPES, type AppType } from "@openscene/constants";
import { z } from "zod";
import { SceneDocumentSchema, type SceneDocument } from "./document";

const nonEmptyString = z.string().min(1);
const unknownRecord = z.record(z.string(), z.unknown());
const appTypeSchema = z.enum(APP_TYPES);

export interface ComponentManifest {
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  /** JSON Schema generated from the component's catalog props schema. */
  props: Record<string, unknown>;
  editor?: Record<string, unknown>;
  events?: Record<string, unknown>;
  /** Whether the component accepts children, or its child capability metadata. */
  children?: unknown;
  /** Named-slot capability metadata (non-empty slots are adapter-defined). */
  slots?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
  [key: string]: unknown;
}

const ComponentManifestSchema = z
  .object({
    title: nonEmptyString,
    description: z.string().optional(),
    category: nonEmptyString.optional(),
    tags: z.array(nonEmptyString).optional(),
    props: unknownRecord,
    editor: unknownRecord.optional(),
    events: unknownRecord.optional(),
    children: z.unknown().optional(),
    slots: unknownRecord.optional(),
    capabilities: unknownRecord.optional(),
  })
  .catchall(z.unknown());

export { ComponentManifestSchema };

export interface AppManifest {
  protocolVersion: string;
  app: {
    key: string;
    type: AppType;
    version?: string;
    [key: string]: unknown;
  };
  components: Record<string, ComponentManifest>;
  actions?: Record<string, unknown>;
  dataSources?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
  [key: string]: unknown;
}

export const AppManifestSchema: z.ZodType<AppManifest> = z
  .object({
    protocolVersion: nonEmptyString,
    app: z
      .object({
        key: nonEmptyString,
        type: appTypeSchema,
        version: nonEmptyString.optional(),
      })
      .catchall(z.unknown()),
    components: z.record(nonEmptyString, ComponentManifestSchema),
    actions: unknownRecord.optional(),
    dataSources: unknownRecord.optional(),
    capabilities: unknownRecord.optional(),
  })
  .catchall(z.unknown()) as z.ZodType<AppManifest>;

export interface RuntimePageDelivery {
  app: {
    id: string;
    key: string;
    type: AppType;
  };
  page: {
    id: string;
    key: string;
    title: string;
  };
  document: SceneDocument;
  [key: string]: unknown;
}

/**
 * Minimal public runtime payload. Release/version metadata may be attached by
 * Admin, but the SDK only needs the app, page, and canonical document fields.
 */
export const RuntimePageDeliverySchema: z.ZodType<RuntimePageDelivery> = z
  .object({
    app: z.object({ id: nonEmptyString, key: nonEmptyString, type: appTypeSchema }),
    page: z.object({ id: nonEmptyString, key: nonEmptyString, title: z.string() }),
    document: SceneDocumentSchema,
  })
  .catchall(z.unknown()) as unknown as z.ZodType<RuntimePageDelivery>;
