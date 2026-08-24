import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { APP_TYPE_WEB, APP_TYPES } from "@openscene/constants";

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
    status: text("status", { enum: ["active", "disabled", "draft", "published"] }).notNull(),
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
    width: integer("width"),
    height: integer("height"),
    ...timestamps,
  },
  (table) => [
    index("assets_app_status_created_index").on(table.appId, table.status, table.createdAt),
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
  schemaMigrations,
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
export type StudioSessionRow = typeof studioSessions.$inferSelect;
