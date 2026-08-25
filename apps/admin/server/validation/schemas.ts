import { APP_TYPES } from "@openscene/constants";
import {
  AgentUiActionSchema,
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
export const PageStatusSchema = z.enum(["active", "disabled", "draft", "published"]);
export const TemplateStatusSchema = z.enum(["draft", "disabled", "published"]);
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
  currentVersionId: IdSchema.nullable().optional(),
  sourceTemplate: z
    .object({ templateId: IdSchema, versionId: IdSchema.nullable().optional() })
    .nullable(),
  status: ResourceStatusSchema,
  defaultPromptId: IdSchema.nullable().optional(),
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
    status: z.enum(["up", "down", "not_configured", "deprecated"]),
    driver: z.enum(["s3", "memory", "none", "deprecated"]).optional(),
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
    defaultPromptId: IdSchema.nullable().optional(),
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
  prompts: z.array(z.record(z.string(), z.unknown())).optional(),
  locales: z.array(z.record(z.string(), z.unknown())).optional(),
  chatSessions: z.array(z.record(z.string(), z.unknown())).optional(),
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
const OpenApiDocumentJsonSchema = z.record(z.string(), z.unknown()).refine((v) => {
  const p = (v as { paths?: unknown }).paths;
  return typeof p === "object" && p !== null && !Array.isArray(p);
}, "OpenAPI document must contain paths");

export const OpenApiDocSchema = z.object({
  id: IdSchema,
  appId: IdSchema,
  name: z.string().min(1),
  json: OpenApiDocumentJsonSchema,
  isDefault: z.boolean(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const OpenApiDocSummarySchema = OpenApiDocSchema.omit({ json: true });

export const OpenApiDocCreateSchema = z.object({
  name: z.string().min(1),
  json: OpenApiDocumentJsonSchema,
  isDefault: z.boolean().optional(),
});

export const OpenApiDocPatchSchema = z.object({
  name: z.string().min(1).optional(),
  json: OpenApiDocumentJsonSchema.optional(),
  isDefault: z.boolean().optional(),
});
export const ResourceCreateSchema = z.object({
  key: KeySchema,
  title: z.string().min(1),
  description: z.string().default(""),
  categoryId: IdSchema.nullable().optional(),
  status: ResourceStatusSchema.default("draft"),
  sourceTemplate: z
    .object({ templateId: IdSchema, versionId: IdSchema.nullable().optional() })
    .optional(),
  defaultPromptId: IdSchema.nullable().optional(),
});
export const ResourcePatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    categoryId: IdSchema.nullable().optional(),
    status: ResourceStatusSchema.optional(),
    defaultPromptId: IdSchema.nullable().optional(),
    currentVersionId: IdSchema.nullable().optional(),
  })
  .passthrough()
  .refine((value) => (value as { key?: unknown }).key === undefined, {
    message: "Resource key cannot be changed",
    path: ["key"],
  })
  .openapi({ description: "Patch a resource" });
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

export const AiProviderSchema = z.enum(["openai", "openai-responses", "anthropic"]).openapi({
  description: "AI provider integration (openai chat, openai-responses, anthropic messages)",
});

export const AiMessageSchema = z
  .object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string().min(1).max(32_000),
  })
  .openapi({ description: "A single chat message" });

// Public AI configuration: the API key is never returned, only whether one is set.
export const AiConfigSchema = z.object({
  id: IdSchema,
  provider: AiProviderSchema,
  model: z.string().min(1).max(200),
  baseUrl: z.string().url().optional().nullable(),
  enabled: z.boolean(),
  hasApiKey: z.boolean(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

// Wrapper for the global AI configuration GET: always returned, `config` is absent until set.
export const AiConfigStatusSchema = z.object({
  configured: z.boolean(),
  config: AiConfigSchema.optional(),
});

export const AiConfigUpdateSchema = z.object({
  provider: AiProviderSchema,
  model: z.string().min(1).max(200),
  baseUrl: z.string().url().optional().nullable(),
  apiKey: z.string().min(1).max(4_000).optional(),
  enabled: z.boolean(),
});

export const AiTestSchema = z.object({
  ok: z.boolean(),
  model: z.string().optional(),
  error: z.string().optional(),
});
export const DEFAULT_GLOBAL_SYSTEM_PROMPT = [
  "You are OpenScene AI, the foundational intelligence layer of the OpenScene system.",
  "Follow strict safety guidelines, execute instructions accurately, and provide structured outputs.",
].join("\n");

export const SystemPromptUpdateSchema = z
  .object({
    prompt: z.string().min(1).max(32_000).optional(),
    enabled: z.boolean().optional(),
  })
  .openapi({ description: "Update the global deployment system prompt configuration" });

export const SystemPromptSchema = z
  .object({
    prompt: z.string(),
    enabled: z.boolean(),
    isDefault: z.boolean(),
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema,
  })
  .openapi({ description: "Global deployment system prompt configuration" });
export const JSON_RENDER_STANDALONE_CORE_PROMPT = [
  "You are OpenScene AI Generative UI engine powered by json-render.",
  "Generate UI specifications strictly following the json-render Standalone Mode specification.",
  "",
  "CRITICAL RULES:",
  "1. Output ONLY JSONL patch lines (RFC 6902 JSON Patch format).",
  "2. Do NOT output markdown code fences (NO ```json, NO ```spec, NO backticks).",
  "3. Do NOT output conversational prose, explanations, greetings, or notes.",
  "4. Each output line MUST be a single, valid, self-contained JSON Patch object.",
  "",
  "SPECIFICATION FORMAT (RFC 6902 JSON Patch):",
  '- Set root: {"op":"add","path":"/root","value":"<root_element_id>"}',
  '- Add/define element: {"op":"add","path":"/elements/<element_id>","value":{"type":"<ComponentType>","props":{...},"children":["<child_id>"]}}',
  '- Update props: {"op":"replace","path":"/elements/<element_id>/props/<prop_name>","value":<value>}',
  '- Remove element: {"op":"remove","path":"/elements/<element_id>"}',
  '- Set/update state: {"op":"add","path":"/state/<key>","value":<value>}',
  "",
  "EXAMPLE OUTPUT:",
  '{"op":"add","path":"/root","value":"card-1"}',
  '{"op":"add","path":"/elements/card-1","value":{"type":"Card","props":{"title":"Dashboard"},"children":["metric-1","btn-1"]}}',
  '{"op":"add","path":"/elements/metric-1","value":{"type":"Metric","props":{"label":"Revenue","value":"$12,450"}}}',
  '{"op":"add","path":"/elements/btn-1","value":{"type":"Button","props":{"text":"Refresh"}}}',
].join("\n");

export const DEFAULT_APP_SYSTEM_PROMPT = JSON_RENDER_STANDALONE_CORE_PROMPT;
export const AppPromptCreateSchema = z
  .object({
    key: KeySchema,
    name: z.string().min(1).max(200),
    description: z.string().max(2_000).default(""),
    system: z.string().max(16_000).default(DEFAULT_APP_SYSTEM_PROMPT),
    sections: z.array(z.string().max(8_000)).max(20).default([]),
    injectedComponents: z.array(z.string().min(1).max(256)).max(100).default([]),
    injectedOpenApiDocIds: z.array(z.string().min(1).max(256)).max(100).default([]),
    isDefault: z.boolean().default(false),
    enabled: z.boolean().default(true),
  })
  .openapi({ description: "Create an app AI prompt profile" });

export const AppPromptPatchSchema = AppPromptCreateSchema.partial().refine(
  (value) => value.key === undefined,
  { message: "Prompt key cannot be changed", path: ["key"] },
);

export const AppPromptSchema = z
  .object({
    id: IdSchema,
    appId: IdSchema,
    key: KeySchema,
    name: z.string(),
    description: z.string(),
    system: z.string(),
    sections: z.array(z.string()),
    injectedComponents: z.array(z.string()),
    injectedOpenApiDocIds: z.array(z.string()),
    isDefault: z.boolean(),
    enabled: z.boolean(),
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema,
  })
  .openapi({ description: "An app AI prompt profile" });

export const AppPromptUpdateSchema = AppPromptCreateSchema.partial();

export const SelectedElementContextSchema = z
  .object({
    nodeId: z.string().min(1),
    type: z.string().min(1),
    props: z.record(z.string(), z.unknown()).optional(),
    children: z.array(z.string()).optional(),
    slots: z.record(z.string(), z.array(z.string())).optional(),
  })
  .openapi({
    description: "Target selected element context from the canvas for fine-grained editing",
  });

// Client consumption request. `format` selects the response representation.
export const AiChatRequestSchema = z
  .object({
    messages: z.array(AiMessageSchema).min(1).max(20),
    model: z.string().min(1).max(200).optional(),
    system: z.string().max(8_000).optional(),
    temperature: z.number().min(0).max(2).optional(),
    format: z.enum(["json", "text", "stream"]).default("json"),
    maxTokens: z.number().int().min(1).max(8_192).optional(),
    appId: z.string().min(1).max(256).openapi({
      description: "App id whose prompt configuration is injected into the system prompt",
    }),
    promptKey: z.string().min(1).max(256).optional().openapi({
      description: "Optional prompt module key to use. Defaults to the app's default prompt.",
    }),
    promptId: z.string().min(1).max(256).optional().openapi({
      description: "Optional prompt module id to use.",
    }),
    selectedElement: SelectedElementContextSchema.optional(),
  })
  .openapi({ description: "AI chat completion request" });

export const AiChatUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

export const AiChatResponseSchema = z.object({
  model: z.string(),
  content: z.string(),
  usage: AiChatUsageSchema,
  uiActions: z.array(AgentUiActionSchema).optional(),
});

export const PromptPreviewRequestSchema = z
  .object({
    appId: z.string().min(1).max(256).optional().openapi({
      description: "App ID whose prompt configuration is inspected",
    }),
    promptKey: z.string().min(1).max(256).optional().openapi({
      description: "Optional prompt module key to use. Defaults to the app's default prompt.",
    }),
    promptId: z.string().min(1).max(256).optional().openapi({
      description: "Optional prompt module id to use.",
    }),
    selectedElement: SelectedElementContextSchema.optional(),
    system: z.string().max(8_000).optional().openapi({
      description: "Optional extra request-level system instructions.",
    }),
  })
  .openapi({ description: "System prompt inspection and preview request" });

export const PromptPreviewBreakdownSchema = z
  .object({
    globalPrompt: z.string().optional(),
    appSystem: z.string().optional(),
    sections: z.array(z.string()).optional(),
    componentsText: z.string().optional(),
    openApiText: z.string().optional(),
    selectedElementText: z.string().optional(),
    requestSystem: z.string().optional(),
  })
  .openapi({ description: "System prompt assembled breakdown parts" });

export const PromptPreviewResponseSchema = z
  .object({
    systemPrompt: z.string().openapi({ description: "Full concatenated system prompt" }),
    breakdown: PromptPreviewBreakdownSchema.optional(),
  })
  .openapi({ description: "Assembled system prompt preview response" });

export const AppStorageConfigSchema = z
  .object({
    appId: IdSchema,
    driver: z.enum(["database", "s3", "memory"]),
    endpoint: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    bucket: z.string().nullable().optional(),
    accessKeyId: z.string().nullable().optional(),
    hasSecretAccessKey: z.boolean(),
    forcePathStyle: z.boolean(),
    publicBaseUrl: z.string().nullable().optional(),
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema,
  })
  .openapi({ description: "App object storage configuration" });

export const AppStorageConfigStatusSchema = z
  .object({
    configured: z.boolean(),
    config: AppStorageConfigSchema.optional(),
  })
  .openapi({ description: "App storage configuration and status" });

export const AppStorageConfigUpsertSchema = z
  .object({
    driver: z.enum(["database", "s3", "memory"]).default("database"),
    endpoint: z.string().url().optional().nullable(),
    region: z.string().optional().nullable(),
    bucket: z.string().max(256).optional().nullable(),
    accessKeyId: z.string().max(256).optional().nullable(),
    secretAccessKey: z.string().max(4096).optional().nullable(),
    forcePathStyle: z.boolean().default(true),
    publicBaseUrl: z.string().url().optional().nullable(),
  })
  .openapi({ description: "Create or update app storage configuration" });

export const AppStorageHealthSchema = z
  .object({
    status: z.enum(["up", "down", "not_configured", "deprecated"]),
    driver: z.enum(["database", "s3", "memory", "none", "deprecated"]),
    detail: z.string().optional(),
  })
  .openapi({ description: "App storage health check result" });

export type ResourceKind = z.infer<typeof ResourceKindSchema>;
