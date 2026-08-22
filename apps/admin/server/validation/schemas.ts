import { APP_TYPES } from "@openscene/constants";
import {
  AppManifestSchema,
  ComponentManifestSchema,
  RuntimePageDeliverySchema,
  SceneDocumentSchema,
} from "@openscene/protocol";
import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

export {
  AppManifestSchema,
  ComponentManifestSchema,
  RuntimePageDeliverySchema,
  SceneDocumentSchema,
};
export const ManifestSchema = AppManifestSchema;

extendZodWithOpenApi(z);

export type { AppManifest as Manifest, SceneDocument } from "@openscene/protocol";

export const IdSchema = z.string().min(1).max(256);
export const KeySchema = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/);
export const IsoDateSchema = z.string().datetime({ offset: true });
export const ResourceKindSchema = z.enum(["page", "template"]);
export const ResourceStatusSchema = z.enum(["active", "disabled", "draft", "published"]);

export const AppSchema = z.object({
  id: IdSchema,
  key: KeySchema,
  name: z.string(),
  description: z.string(),
  type: z.enum(APP_TYPES),
  status: z.enum(["active", "disabled"]),
  manifest: z.object({
    mode: z.enum(["remote", "push"]),
    url: z.string().url().optional(),
    activeRevisionId: IdSchema.optional(),
  }),
  runtime: z.object({ publicBaseUrl: z.string().url().optional() }),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
  credentials: z.object({ appKey: z.string(), runtimeKey: z.string() }).optional(),
});
export const AppKeyRotationSchema = z.object({ appKey: z.string().min(1) });

export const PreviewProfileSchema = z.object({
  id: IdSchema,
  appId: IdSchema,
  name: z.string().min(1),
  url: z.string().url(),
  allowedOrigins: z.array(z.string().url()),
  isDefault: z.boolean(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const CategorySchema = z.object({
  id: IdSchema,
  appId: IdSchema,
  scope: z.enum(["page", "template", "shared"]),
  key: KeySchema,
  name: z.string(),
  isDefault: z.boolean(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const LocaleSchema = z.object({
  id: IdSchema,
  appId: IdSchema,
  code: z.string().regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})*$/),
  name: z.string(),
  isDefault: z.boolean(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const ResourceSchema = z.object({
  id: IdSchema,
  appId: IdSchema,
  key: KeySchema,
  title: z.string(),
  description: z.string(),
  categoryId: IdSchema.nullable(),
  documentId: IdSchema,
  status: ResourceStatusSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const DocumentSchema = z.object({
  id: IdSchema,
  appId: IdSchema,
  resourceKind: ResourceKindSchema,
  resourceId: IdSchema,
  schemaVersion: z.string(),
  revision: z.number().int().nonnegative(),
  draft: SceneDocumentSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const VersionSchema = z.object({
  id: IdSchema,
  appId: IdSchema,
  documentId: IdSchema,
  versionNumber: z.number().int().positive(),
  document: SceneDocumentSchema,
  sourceRevision: z.number().int().nonnegative(),
  message: z.string(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const ReleaseSchema = z.object({
  id: IdSchema,
  appId: IdSchema,
  documentId: IdSchema,
  versionId: IdSchema,
  channel: z.string().min(1),
  status: z.enum(["active", "superseded", "failed"]),
  storageKey: z.string(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const AssetSchema = z.object({
  id: IdSchema,
  appId: IdSchema,
  status: z.enum(["pending", "ready", "failed"]),
  fileName: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  storageKey: z.string(),
  checksum: z.string().nullable(),
  width: z.number().int().nonnegative().nullable(),
  height: z.number().int().nonnegative().nullable(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const ManifestRevisionSchema = z.object({
  id: IdSchema,
  appId: IdSchema,
  protocolVersion: z.string(),
  appKey: KeySchema,
  manifest: AppManifestSchema,
  checksum: z.string(),
  source: z.enum(["push", "sync"]),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const HealthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.object({ status: z.enum(["up", "down"]) }),
  storage: z.object({
    status: z.enum(["up", "down", "not_configured"]),
    driver: z.enum(["s3", "memory"]),
    detail: z.string().optional(),
  }),
});

export const StudioSessionSchema = z.object({
  id: IdSchema,
  token: z.string(),
  expiresAt: IsoDateSchema,
  resourceKind: ResourceKindSchema,
  resourceId: IdSchema,
  launchUrl: z.string().url(),
});
export const UiSessionSchema = z.object({
  authenticated: z.boolean(),
  mode: z.enum(["disabled", "token", "proxy"]),
  expiresAt: IsoDateSchema.optional(),
});
export const UiSessionCreateSchema = z.object({ token: z.string().min(1) });
export const BootstrapSchema = z.object({
  session: z.object({ id: IdSchema, expiresAt: IsoDateSchema }),
  app: z.object({
    id: IdSchema,
    key: KeySchema,
    name: z.string(),
    type: z.enum(APP_TYPES),
  }),
  resource: z.object({
    id: IdSchema,
    kind: ResourceKindSchema,
    title: z.string(),
    documentId: IdSchema,
  }),
  draft: z.object({ revision: z.number().int().nonnegative(), document: SceneDocumentSchema }),
  manifest: AppManifestSchema.nullable(),
  preview: z.object({
    url: z.string().url(),
    allowedOrigin: z.string().url(),
    profileId: IdSchema,
  }),
  capabilities: z.object({
    saveDraft: z.boolean(),
    createVersion: z.boolean(),
    publish: z.boolean(),
    uploadAsset: z.boolean(),
  }),
  returnUrl: z.string().url(),
});
export const RuntimeDeliverySchema = RuntimePageDeliverySchema;
export const UploadIntentResponseSchema = z.object({
  asset: AssetSchema,
  uploadUrl: z.string(),
  expiresAt: IsoDateSchema,
});

export const ListResponseSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });

export const ProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

export const AppCreateSchema = z.object({
  key: KeySchema,
  name: z.string().min(1).max(200),
  type: z.enum(APP_TYPES),
  description: z.string().max(2_000).default(""),
  status: z.enum(["active", "disabled"]).default("active"),
  manifest: z
    .object({ mode: z.enum(["remote", "push"]).default("push"), url: z.string().url().optional() })
    .default({ mode: "push" }),
  runtimePublicBaseUrl: z.string().url().optional(),
});
export const AppPatchSchema = AppCreateSchema.omit({ type: true })
  .partial()
  .refine((value) => value.key === undefined, {
    message: "App key cannot be changed",
    path: ["key"],
  });
export const PreviewProfileCreateSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  allowedOrigins: z.array(z.string().url()).min(1),
  isDefault: z.boolean().default(false),
});
export const PreviewProfilePatchSchema = PreviewProfileCreateSchema.partial();
export const CategoryCreateSchema = z.object({
  scope: z.enum(["page", "template", "shared"]),
  key: KeySchema,
  name: z.string().min(1),
  isDefault: z.boolean().default(false),
});
export const CategoryPatchSchema = CategoryCreateSchema.partial().refine(
  (value) => value.key === undefined,
  { message: "Category key cannot be changed", path: ["key"] },
);
export const LocaleCreateSchema = z.object({
  code: z.string().regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})*$/),
  name: z.string().min(1),
  isDefault: z.boolean().default(false),
});
export const LocalePatchSchema = LocaleCreateSchema.partial().refine(
  (value) => value.code === undefined,
  { message: "Locale code cannot be changed", path: ["code"] },
);
export const ResourceCreateSchema = z.object({
  key: KeySchema,
  title: z.string().min(1),
  description: z.string().default(""),
  categoryId: IdSchema.optional(),
  status: ResourceStatusSchema.default("draft"),
  sourceTemplate: z.object({ templateId: IdSchema, versionId: IdSchema }).optional(),
});
export const ResourcePatchSchema = ResourceCreateSchema.partial()
  .omit({ sourceTemplate: true })
  .refine((value) => value.key === undefined, {
    message: "Resource key cannot be changed",
    path: ["key"],
  });
export const DraftPatchSchema = z.object({
  baseRevision: z.number().int().nonnegative().optional(),
  document: SceneDocumentSchema,
});
export const VersionCreateSchema = z.object({
  message: z.string().max(2_000).default(""),
  sourceRevision: z.number().int().nonnegative().optional(),
});
export const ReleaseCreateSchema = z.object({
  versionId: IdSchema,
  channel: z
    .string()
    .regex(/^[a-z0-9][a-z0-9._-]*$/)
    .default("production"),
});
export const StudioSessionCreateSchema = z.object({
  resourceKind: ResourceKindSchema,
  resourceId: IdSchema,
  previewProfileId: IdSchema,
  returnUrl: z.string().url(),
});
export const UploadIntentSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
});
export const AssetCompleteSchema = z.object({
  checksum: z.string().optional(),
  width: z.number().int().nonnegative().optional(),
  height: z.number().int().nonnegative().optional(),
});

export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().optional(),
  status: ResourceStatusSchema.optional(),
  categoryId: IdSchema.optional(),
});

export type ResourceKind = z.infer<typeof ResourceKindSchema>;
