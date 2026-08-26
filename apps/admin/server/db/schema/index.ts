import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { APP_TYPE_WEB, APP_TYPES } from "@openscene-ai/core";
export * from "./auth";
import {
  user,
  session,
  account,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,
} from "./auth";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const apps = sqliteTable(
  "apps",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    type: text("type", { enum: APP_TYPES }).notNull().default(APP_TYPE_WEB),
    status: text("status", { enum: ["active", "disabled"] }).notNull(),
    manifestMode: text("manifest_mode", { enum: ["remote", "push"] }).notNull(),
    manifestUrl: text("manifest_url"),
    activeManifestRevisionId: text("active_manifest_revision_id"),
    runtimePublicBaseUrl: text("runtime_public_base_url"),
    ...timestamps,
  },
  (table) => [uniqueIndex("apps_key_unique").on(table.key)],
);

export const previewProfiles = sqliteTable(
  "preview_profiles",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    allowedOriginsJson: text("allowed_origins_json").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    encryptedHeadersJson: text("encrypted_headers_json"),
    ...timestamps,
  },
  (table) => [index("preview_profiles_app_index").on(table.appId)],
);
export const appOpenApiDocs = sqliteTable(
  "app_openapi_docs",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    json: text("json").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [index("app_openapi_docs_app_index").on(table.appId)],
);
export const appPrompts = sqliteTable(
  "app_prompts",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    system: text("system").notNull(),
    sections: text("sections").notNull().default("[]"),
    injectedComponents: text("injected_components").notNull().default("[]"),
    injectedOpenApiDocIds: text("injected_openapi_doc_ids").notNull().default("[]"),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("app_prompts_app_key_unique").on(table.appId, table.key),
    index("app_prompts_app_index").on(table.appId),
  ],
);

export const manifestRevisions = sqliteTable(
  "manifest_revisions",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "restrict" }),
    protocolVersion: text("protocol_version").notNull(),
    appKey: text("app_key").notNull(),
    manifestJson: text("manifest_json").notNull(),
    checksum: text("checksum").notNull(),
    source: text("source", { enum: ["push", "sync"] }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("manifest_revisions_app_index").on(table.appId, table.createdAt),
    uniqueIndex("manifest_revisions_app_checksum_unique").on(table.appId, table.checksum),
  ],
);

export const appKeys = sqliteTable(
  "app_keys",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "restrict" }),
    kind: text("kind", { enum: ["app", "runtime"] }).notNull(),
    keyHash: text("key_hash").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("app_keys_hash_unique").on(table.keyHash),
    index("app_keys_app_index").on(table.appId),
  ],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "restrict" }),
    scope: text("scope", { enum: ["page", "template", "shared"] }).notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("categories_app_scope_key_unique").on(table.appId, table.scope, table.key),
  ],
);

export const locales = sqliteTable(
  "locales",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [uniqueIndex("locales_app_code_unique").on(table.appId, table.code)],
);

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "restrict" }),
    resourceKind: text("resource_kind", { enum: ["page", "template"] }).notNull(),
    resourceId: text("resource_id").notNull(),
    schemaVersion: text("schema_version").notNull(),
    revision: integer("revision").notNull().default(0),
    draftJson: text("draft_json").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("documents_resource_unique").on(table.appId, table.resourceKind, table.resourceId),
    uniqueIndex("documents_app_id_unique").on(table.appId, table.id),
  ],
);

export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "restrict" }),
    key: text("key").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "restrict" }),
    documentId: text("document_id").notNull(),
    sourceTemplateId: text("source_template_id"),
    sourceTemplateVersionId: text("source_template_version_id"),
    status: text("status", { enum: ["active", "disabled", "draft", "published"] }).notNull(),
    defaultPromptId: text("default_prompt_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("pages_app_key_unique").on(table.appId, table.key),
    foreignKey({
      columns: [table.appId, table.documentId],
      foreignColumns: [documents.appId, documents.id],
      name: "pages_document_app_fk",
    }),
  ],
);

export const templates = sqliteTable(
  "templates",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "restrict" }),
    key: text("key").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "restrict" }),
    documentId: text("document_id").notNull(),
    currentVersionId: text("current_version_id"),
    status: text("status", { enum: ["draft", "disabled", "published"] }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("templates_app_key_unique").on(table.appId, table.key),
    foreignKey({
      columns: [table.appId, table.documentId],
      foreignColumns: [documents.appId, documents.id],
      name: "templates_document_app_fk",
    }),
  ],
);

export const documentVersions = sqliteTable(
  "document_versions",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "restrict" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    documentJson: text("document_json").notNull(),
    sourceRevision: integer("source_revision").notNull(),
    message: text("message").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("document_versions_document_number_unique").on(
      table.documentId,
      table.versionNumber,
    ),
    index("document_versions_document_index").on(table.documentId, table.createdAt),
  ],
);

export const releases = sqliteTable(
  "releases",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "restrict" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "restrict" }),
    versionId: text("version_id")
      .notNull()
      .references(() => documentVersions.id, { onDelete: "restrict" }),
    channel: text("channel").notNull(),
    status: text("status", { enum: ["active", "superseded", "failed"] }).notNull(),
    storageKey: text("storage_key").notNull(),
    ...timestamps,
  },
  (table) => [
    index("releases_document_index").on(
      table.appId,
      table.documentId,
      table.channel,
      table.createdAt,
    ),
  ],
);

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "restrict" }),
    status: text("status", { enum: ["pending", "ready", "failed"] }).notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    storageKey: text("storage_key").notNull(),
    checksum: text("checksum"),
    folder: text("folder").notNull().default("/"),
    tags: text("tags"),
    metadata: text("metadata"),
    width: integer("width"),
    height: integer("height"),
    duration: integer("duration"),
    ...timestamps,
  },
  (table) => [
    index("assets_app_status_created_index").on(table.appId, table.status, table.createdAt),
    index("assets_app_folder_index").on(table.appId, table.folder),
    uniqueIndex("assets_storage_key_unique").on(table.storageKey),
  ],
);

export const studioSessions = sqliteTable(
  "studio_sessions",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "restrict" }),
    resourceKind: text("resource_kind", { enum: ["page", "template"] }).notNull(),
    resourceId: text("resource_id").notNull(),
    previewProfileId: text("preview_profile_id")
      .notNull()
      .references(() => previewProfiles.id, { onDelete: "restrict" }),
    returnUrl: text("return_url").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    ...timestamps,
  },
  (table) => [
    index("studio_sessions_app_expiry_index").on(table.appId, table.expiresAt),
    uniqueIndex("studio_sessions_token_unique").on(table.tokenHash),
  ],
);

export const schemaMigrations = sqliteTable(
  "schema_migrations",
  {
    id: text("id").notNull(),
    appliedAt: text("applied_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);

export const aiConfig = sqliteTable(
  "ai_config",
  {
    id: text("id").primaryKey(),
    provider: text("provider", { enum: ["openai", "openai-responses", "anthropic"] }).notNull(),
    model: text("model").notNull(),
    baseUrl: text("base_url"),
    apiKeyEnc: text("api_key_enc").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [index("ai_config_provider_index").on(table.provider)],
);

export const systemPrompts = sqliteTable("system_prompts", {
  id: text("id").primaryKey(),
  prompt: text("prompt").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const aiChatSessions = sqliteTable(
  "ai_chat_sessions",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    resourceKind: text("resource_kind", { enum: ["page", "template"] }).notNull(),
    resourceId: text("resource_id").notNull(),
    json: text("json").notNull().default("[]"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ai_chat_sessions_resource_unique").on(
      table.appId,
      table.resourceKind,
      table.resourceId,
    ),
    index("ai_chat_sessions_app_idx").on(table.appId),
  ],
);
export const appStorageConfigs = sqliteTable(
  "app_storage_configs",
  {
    appId: text("app_id")
      .primaryKey()
      .references(() => apps.id, { onDelete: "cascade" }),
    driver: text("driver", { enum: ["database", "s3", "memory"] })
      .notNull()
      .default("database"),
    pageDriver: text("page_driver", { enum: ["database", "s3", "memory"] })
      .notNull()
      .default("database"),
    s3Enabled: integer("s3_enabled", { mode: "boolean" }).notNull().default(false),
    endpoint: text("endpoint"),
    region: text("region").default("auto"),
    bucket: text("bucket"),
    accessKeyId: text("access_key_id"),
    secretAccessKeyEnc: text("secret_access_key_enc"),
    forcePathStyle: integer("force_path_style", { mode: "boolean" }).notNull().default(true),
    publicBaseUrl: text("public_base_url"),
    ...timestamps,
  },
  (table) => [index("app_storage_configs_app_idx").on(table.appId)],
);

export const storageObjects = sqliteTable(
  "storage_objects",
  {
    key: text("key").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    checksum: text("checksum").notNull(),
    data: text("data").notNull(),
    ...timestamps,
  },
  (table) => [index("storage_objects_app_idx").on(table.appId)],
);

export const schema = {
  apps,
  previewProfiles,
  manifestRevisions,
  appOpenApiDocs,
  appKeys,
  pages,
  templates,
  documents,
  documentVersions,
  releases,
  categories,
  locales,
  assets,
  studioSessions,
  aiConfig,
  appPrompts,
  systemPrompts,
  aiChatSessions,
  appStorageConfigs,
  storageObjects,
  user,
  session,
  account,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,
};

export type AppRow = typeof apps.$inferSelect;
export type PreviewProfileRow = typeof previewProfiles.$inferSelect;
export type AppOpenApiDocRow = typeof appOpenApiDocs.$inferSelect;
export type PageRow = typeof pages.$inferSelect;
export type TemplateRow = typeof templates.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type DocumentVersionRow = typeof documentVersions.$inferSelect;
export type ReleaseRow = typeof releases.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;
export type AppPromptRow = typeof appPrompts.$inferSelect;
export type StudioSessionRow = typeof studioSessions.$inferSelect;

export type AiConfigRow = typeof aiConfig.$inferSelect;
export type SystemPromptRow = typeof systemPrompts.$inferSelect;
export type AiChatSessionRow = typeof aiChatSessions.$inferSelect;
export type StorageObjectRow = typeof storageObjects.$inferSelect;
export type AppStorageConfigRow = typeof appStorageConfigs.$inferSelect;
