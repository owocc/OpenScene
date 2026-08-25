import { and, asc, desc, eq, isNull, like, ne, or } from "drizzle-orm";
import type { AppDatabase } from "../db/client";
import { hashSecret, newId, newSecret, nowIso } from "../db/ids";
import {
  aiChatSessions,
  appKeys,
  appOpenApiDocs,
  appPrompts,
  apps,
  appStorageConfigs,
  assets,
  categories,
  documentVersions,
  documents,
  locales,
  manifestRevisions,
  pages,
  previewProfiles,
  releases,
  studioSessions,
  templates,
} from "../db/schema";
import { getConfig } from "../config/env";
import {
  conflict,
  notFound,
  payloadTooLarge,
  ProblemError,
  unavailable,
  validation,
} from "../errors";
import { getAppStorage, invalidateAppStorage, S3StorageAdapter } from "../storage";
import { encryptSecret, decryptSecret } from "../crypto/encryption";
import { assetObjectKey, releaseObjectKey } from "../storage/keys";
import {
  AppManifestSchema,
  RuntimePageDeliverySchema,
  SceneDocumentSchema,
  createEmptySceneDocument,
  type SceneDocument,
} from "@openscene/protocol";
import {
  AppCreateSchema,
  AppKeyRotationSchema,
  AppPatchSchema,
  AppPromptCreateSchema,
  AppPromptPatchSchema,
  AppPromptSchema,
  AppSchema,
  AssetCompleteSchema,
  AssetSchema,
  CategoryCreateSchema,
  CategoryPatchSchema,
  CategorySchema,
  DocumentSchema,
  DraftPatchSchema,
  LocaleCreateSchema,
  LocalePatchSchema,
  LocaleSchema,
  OpenApiDocCreateSchema,
  OpenApiDocPatchSchema,
  OpenApiDocSchema,
  PaginationQuerySchema,
  PreviewProfileCreateSchema,
  PreviewProfilePatchSchema,
  ReleaseCreateSchema,
  ReleaseSchema,
  ResourceCreateSchema,
  ResourcePatchSchema,
  ResourceSchema,
  StudioSessionCreateSchema,
  UploadIntentSchema,
  VersionCreateSchema,
  DEFAULT_APP_SYSTEM_PROMPT,
  type ResourceKind,
  VersionSchema,
  AppStorageConfigSchema,
  AppStorageConfigStatusSchema,
  AppStorageConfigUpsertSchema,
  AppStorageHealthSchema,
} from "../validation/schemas";
import { z } from "zod";
type ResourceRow = typeof pages.$inferSelect | typeof templates.$inferSelect;
type ResourceRecordInput = {
  id: string;
  appId: string;
  key: string;
  title: string;
  description: string;
  categoryId: string | null | undefined;
  documentId: string;
  currentVersionId?: string | null | undefined;
  sourceTemplateId?: string | null | undefined;
  sourceTemplateVersionId?: string | null | undefined;
  status: "active" | "disabled" | "draft" | "published";
  defaultPromptId?: string | null | undefined;
  createdAt: string;
  updatedAt: string;
};

const EmptyDocument = createEmptySceneDocument();

export async function listApps(
  db: AppDatabase,
  query: URLSearchParams,
): Promise<{ items: unknown[]; nextCursor: string | null }> {
  const limit = parseLimit(query.get("limit"));
  const rows = await db.select().from(apps).orderBy(asc(apps.createdAt), asc(apps.id)).all();
  const offset = decodeCursor(query.get("cursor"));
  const items = rows.slice(offset, offset + limit).map((row) => appRecord(row));
  return { items, nextCursor: offset + limit < rows.length ? encodeCursor(offset + limit) : null };
}

export async function createApp(db: AppDatabase, input: unknown): Promise<unknown> {
  const body = AppCreateSchema.parse(input);
  if (body.manifest.mode === "remote" && !body.manifest.url)
    throw validation("Remote manifest mode requires a manifest URL");
  const id = newId("app");
  const appKey = newSecret("appkey");
  const runtimeKey = newSecret("runtime");
  const timestamp = nowIso();
  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(apps)
        .values({
          id,
          key: body.key,
          name: body.name,
          description: body.description,
          type: body.type,
          status: body.status,
          manifestMode: body.manifest.mode,
          manifestUrl: body.manifest.url,
          runtimePublicBaseUrl: body.runtimePublicBaseUrl,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
      await tx
        .insert(appKeys)
        .values([
          {
            id: newId("key"),
            appId: id,
            kind: "app",
            keyHash: hashSecret(appKey),
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          {
            id: newId("key"),
            appId: id,
            kind: "runtime",
            keyHash: hashSecret(runtimeKey),
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ])
        .run();
      await tx
        .insert(categories)
        .values({
          id: newId("category"),
          appId: id,
          scope: "shared",
          key: "default",
          name: "Default",
          isDefault: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
      await tx
        .insert(locales)
        .values({
          id: newId("locale"),
          appId: id,
          code: "en",
          name: "English",
          isDefault: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
    });
  } catch (error) {
    if (isConstraintError(error))
      throw conflict("App key already exists", [{ path: "key", message: "Key already exists" }]);
    throw error;
  }
  const created = await db.select().from(apps).where(eq(apps.id, id)).get();
  if (!created) throw new Error("Created app could not be read");
  const record = appRecord(created);
  if (typeof record !== "object" || record === null)
    throw new Error("Created app record is invalid");
  return AppSchema.parse({
    ...(record as Record<string, unknown>),
    credentials: { appKey, runtimeKey },
  });
}

export async function getApp(db: AppDatabase, appId: string): Promise<unknown> {
  const row = await db.select().from(apps).where(eq(apps.id, appId)).get();
  if (!row) throw notFound();
  return AppSchema.parse(appRecord(row));
}
export async function rotateAppKey(db: AppDatabase, appId: string): Promise<{ appKey: string }> {
  await getAppRow(db, appId);
  const appKey = newSecret("appkey");
  const timestamp = nowIso();
  await db.transaction(async (tx) => {
    await tx
      .update(appKeys)
      .set({ revokedAt: timestamp, updatedAt: timestamp })
      .where(and(eq(appKeys.appId, appId), eq(appKeys.kind, "app"), isNull(appKeys.revokedAt)))
      .run();
    await tx
      .insert(appKeys)
      .values({
        id: newId("key"),
        appId,
        kind: "app",
        keyHash: hashSecret(appKey),
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
  });
  return AppKeyRotationSchema.parse({ appKey });
}

export async function updateApp(db: AppDatabase, appId: string, input: unknown): Promise<unknown> {
  const body = AppPatchSchema.parse(input);
  const existing = await getAppRow(db, appId);
  const timestamp = nowIso();
  await db
    .update(apps)
    .set({
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      status: body.status ?? existing.status,
      manifestMode: body.manifest?.mode ?? existing.manifestMode,
      manifestUrl: body.manifest?.url ?? existing.manifestUrl,
      runtimePublicBaseUrl: body.runtimePublicBaseUrl ?? existing.runtimePublicBaseUrl,
      updatedAt: timestamp,
    })
    .where(eq(apps.id, appId))
    .run();
  const row = await getAppRow(db, appId);
  return AppSchema.parse(appRecord(row));
}

export async function deleteApp(db: AppDatabase, appId: string): Promise<void> {
  await getAppRow(db, appId);
  const checks = await Promise.all([
    db.select({ id: pages.id }).from(pages).where(eq(pages.appId, appId)).limit(1).all(),
    db
      .select({ id: templates.id })
      .from(templates)
      .where(eq(templates.appId, appId))
      .limit(1)
      .all(),
    db.select({ id: assets.id }).from(assets).where(eq(assets.appId, appId)).limit(1).all(),
    db.select({ id: releases.id }).from(releases).where(eq(releases.appId, appId)).limit(1).all(),
    db
      .select({ id: documentVersions.id })
      .from(documentVersions)
      .where(eq(documentVersions.appId, appId))
      .limit(1)
      .all(),
  ]);
  if (checks.some((items) => items.length > 0))
    throw conflict("App still has resources and cannot be deleted");
  await db.transaction(async (tx) => {
    await tx.delete(studioSessions).where(eq(studioSessions.appId, appId)).run();
    await tx.delete(appKeys).where(eq(appKeys.appId, appId)).run();
    await tx.delete(manifestRevisions).where(eq(manifestRevisions.appId, appId)).run();
    await tx.delete(previewProfiles).where(eq(previewProfiles.appId, appId)).run();
    await tx.delete(categories).where(eq(categories.appId, appId)).run();
    await tx.delete(locales).where(eq(locales.appId, appId)).run();
    await tx.delete(documents).where(eq(documents.appId, appId)).run();
    await tx.delete(appPrompts).where(eq(appPrompts.appId, appId)).run();
    await tx.delete(apps).where(eq(apps.id, appId)).run();
  });
}

function appPromptRecord(row: typeof appPrompts.$inferSelect) {
  return {
    id: row.id,
    appId: row.appId,
    key: row.key,
    name: row.name,
    description: row.description,
    system: row.system,
    sections: parseJson(z.array(z.string()), row.sections),
    injectedComponents: parseJson(z.array(z.string()), row.injectedComponents),
    injectedOpenApiDocIds: parseJson(z.array(z.string()), row.injectedOpenApiDocIds),
    isDefault: row.isDefault,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listAppPrompts(db: AppDatabase, appId: string): Promise<unknown[]> {
  await getAppRow(db, appId);
  let rows = await db
    .select()
    .from(appPrompts)
    .where(eq(appPrompts.appId, appId))
    .orderBy(desc(appPrompts.isDefault), asc(appPrompts.createdAt))
    .all();

  if (rows.length === 0) {
    const timestamp = nowIso();
    const defaultRow = {
      id: newId("prompt"),
      appId,
      key: "default",
      name: "Default",
      description: "Default app AI prompt profile",
      system: DEFAULT_APP_SYSTEM_PROMPT,
      sections: "[]",
      injectedComponents: "[]",
      injectedOpenApiDocIds: "[]",
      isDefault: true,
      enabled: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.insert(appPrompts).values(defaultRow).run();
    rows = [defaultRow];
  }

  return rows.map((r) => AppPromptSchema.parse(appPromptRecord(r)));
}

export async function createAppPrompt(
  db: AppDatabase,
  appId: string,
  input: unknown,
): Promise<unknown> {
  await getAppRow(db, appId);
  const body = AppPromptCreateSchema.parse(input);
  const timestamp = nowIso();
  const existingKey = await db
    .select({ id: appPrompts.id })
    .from(appPrompts)
    .where(and(eq(appPrompts.appId, appId), eq(appPrompts.key, body.key)))
    .get();
  if (existingKey) {
    throw conflict("A prompt profile with this key already exists for the app");
  }

  const existingCount = (
    await db.select({ id: appPrompts.id }).from(appPrompts).where(eq(appPrompts.appId, appId)).all()
  ).length;

  const isDefault = body.isDefault || existingCount === 0;
  const row = {
    id: newId("prompt"),
    appId,
    key: body.key,
    name: body.name,
    description: body.description ?? "",
    system: body.system ?? DEFAULT_APP_SYSTEM_PROMPT,
    sections: JSON.stringify(body.sections ?? []),
    injectedComponents: JSON.stringify(body.injectedComponents ?? []),
    injectedOpenApiDocIds: JSON.stringify(body.injectedOpenApiDocIds ?? []),
    isDefault,
    enabled: body.enabled ?? true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.transaction(async (tx) => {
    if (isDefault) {
      await tx
        .update(appPrompts)
        .set({ isDefault: false, updatedAt: timestamp })
        .where(eq(appPrompts.appId, appId))
        .run();
    }
    await tx.insert(appPrompts).values(row).run();
  });

  return AppPromptSchema.parse(appPromptRecord(row));
}

export async function getAppPrompt(
  db: AppDatabase,
  appId: string,
  promptId: string,
): Promise<unknown> {
  await getAppRow(db, appId);
  const row = await db
    .select()
    .from(appPrompts)
    .where(and(eq(appPrompts.appId, appId), eq(appPrompts.id, promptId)))
    .get();
  if (!row) throw notFound();
  return AppPromptSchema.parse(appPromptRecord(row));
}

export async function updateAppPrompt(
  db: AppDatabase,
  appId: string,
  promptId: string,
  input: unknown,
): Promise<unknown> {
  await getAppRow(db, appId);
  const existing = await db
    .select()
    .from(appPrompts)
    .where(and(eq(appPrompts.appId, appId), eq(appPrompts.id, promptId)))
    .get();
  if (!existing) throw notFound();

  const body = AppPromptPatchSchema.parse(input);
  const timestamp = nowIso();

  await db.transaction(async (tx) => {
    if (body.isDefault) {
      await tx
        .update(appPrompts)
        .set({ isDefault: false, updatedAt: timestamp })
        .where(eq(appPrompts.appId, appId))
        .run();
    }
    await tx
      .update(appPrompts)
      .set({
        name: body.name ?? existing.name,
        description: body.description ?? existing.description,
        system: body.system ?? existing.system,
        sections: body.sections !== undefined ? JSON.stringify(body.sections) : existing.sections,
        injectedComponents:
          body.injectedComponents !== undefined
            ? JSON.stringify(body.injectedComponents)
            : existing.injectedComponents,
        injectedOpenApiDocIds:
          body.injectedOpenApiDocIds !== undefined
            ? JSON.stringify(body.injectedOpenApiDocIds)
            : existing.injectedOpenApiDocIds,
        isDefault: body.isDefault ?? existing.isDefault,
        enabled: body.enabled ?? existing.enabled,
        updatedAt: timestamp,
      })
      .where(and(eq(appPrompts.appId, appId), eq(appPrompts.id, promptId)))
      .run();
  });

  return getAppPrompt(db, appId, promptId);
}

export async function deleteAppPrompt(
  db: AppDatabase,
  appId: string,
  promptId: string,
): Promise<void> {
  await getAppRow(db, appId);
  const row = await db
    .select()
    .from(appPrompts)
    .where(and(eq(appPrompts.appId, appId), eq(appPrompts.id, promptId)))
    .get();
  if (!row) throw notFound();
  if (row.isDefault) {
    const others = await db
      .select({ id: appPrompts.id })
      .from(appPrompts)
      .where(and(eq(appPrompts.appId, appId), ne(appPrompts.id, promptId)))
      .limit(1)
      .all();
    if (others.length > 0) {
      throw conflict(
        "The default prompt profile cannot be deleted without setting another as default first",
      );
    }
  }

  await db
    .delete(appPrompts)
    .where(and(eq(appPrompts.appId, appId), eq(appPrompts.id, promptId)))
    .run();
}

export async function listPreviewProfiles(db: AppDatabase, appId: string): Promise<unknown[]> {
  await getAppRow(db, appId);
  const rows = await db
    .select()
    .from(previewProfiles)
    .where(eq(previewProfiles.appId, appId))
    .orderBy(asc(previewProfiles.createdAt))
    .all();
  return rows.map(previewRecord);
}

export async function createPreviewProfile(
  db: AppDatabase,
  appId: string,
  input: unknown,
): Promise<unknown> {
  await getAppRow(db, appId);
  const body = PreviewProfileCreateSchema.parse(input);
  const allowedOrigins = normalizeOrigins(body.allowedOrigins);
  const timestamp = nowIso();
  const id = newId("preview");
  try {
    await db.transaction(async (tx) => {
      if (body.isDefault)
        await tx
          .update(previewProfiles)
          .set({ isDefault: false, updatedAt: timestamp })
          .where(eq(previewProfiles.appId, appId))
          .run();
      await tx
        .insert(previewProfiles)
        .values({
          id,
          appId,
          name: body.name,
          url: normalizeHttpUrl(body.url),
          allowedOriginsJson: JSON.stringify(allowedOrigins),
          isDefault: body.isDefault,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
    });
  } catch (error) {
    if (isConstraintError(error)) throw conflict("Preview profile could not be created");
    throw error;
  }
  return previewRecord(await getPreviewRow(db, appId, id));
}

export async function getPreviewProfile(
  db: AppDatabase,
  appId: string,
  profileId: string,
): Promise<unknown> {
  return previewRecord(await getPreviewRow(db, appId, profileId));
}

export async function updatePreviewProfile(
  db: AppDatabase,
  appId: string,
  profileId: string,
  input: unknown,
): Promise<unknown> {
  const existing = await getPreviewRow(db, appId, profileId);
  const body = PreviewProfilePatchSchema.parse(input);
  const timestamp = nowIso();
  await db.transaction(async (tx) => {
    if (body.isDefault)
      await tx
        .update(previewProfiles)
        .set({ isDefault: false, updatedAt: timestamp })
        .where(eq(previewProfiles.appId, appId))
        .run();
    await tx
      .update(previewProfiles)
      .set({
        name: body.name ?? existing.name,
        url: body.url ? normalizeHttpUrl(body.url) : existing.url,
        allowedOriginsJson: body.allowedOrigins
          ? JSON.stringify(normalizeOrigins(body.allowedOrigins))
          : existing.allowedOriginsJson,
        isDefault: body.isDefault ?? existing.isDefault,
        updatedAt: timestamp,
      })
      .where(and(eq(previewProfiles.appId, appId), eq(previewProfiles.id, profileId)))
      .run();
  });
  return previewRecord(await getPreviewRow(db, appId, profileId));
}

export async function deletePreviewProfile(
  db: AppDatabase,
  appId: string,
  profileId: string,
): Promise<void> {
  const profile = await getPreviewRow(db, appId, profileId);
  if (profile.isDefault) throw conflict("The default Preview Profile cannot be deleted");
  const session = await db
    .select({ id: studioSessions.id })
    .from(studioSessions)
    .where(eq(studioSessions.previewProfileId, profileId))
    .limit(1)
    .get();
  if (session) throw conflict("Preview Profile is referenced by a Studio Session");
  await db
    .delete(previewProfiles)
    .where(and(eq(previewProfiles.appId, appId), eq(previewProfiles.id, profileId)))
    .run();
}

export async function getManifest(db: AppDatabase, appId: string): Promise<unknown> {
  const app = await getAppRow(db, appId);
  if (!app.activeManifestRevisionId) return { manifest: null, revision: null };
  const revision = await db
    .select()
    .from(manifestRevisions)
    .where(
      and(
        eq(manifestRevisions.appId, appId),
        eq(manifestRevisions.id, app.activeManifestRevisionId),
      ),
    )
    .get();
  if (!revision) return { manifest: null, revision: null };
  return {
    manifest: parseJson(AppManifestSchema, revision.manifestJson),
    revision: manifestRevisionRecord(revision),
  };
}

export async function listManifestRevisions(db: AppDatabase, appId: string): Promise<unknown[]> {
  await getAppRow(db, appId);
  const rows = await db
    .select()
    .from(manifestRevisions)
    .where(eq(manifestRevisions.appId, appId))
    .orderBy(desc(manifestRevisions.createdAt))
    .all();
  return rows.map(manifestRevisionRecord);
}

export async function getManifestRevision(
  db: AppDatabase,
  appId: string,
  revisionId: string,
): Promise<unknown> {
  const row = await db
    .select()
    .from(manifestRevisions)
    .where(and(eq(manifestRevisions.appId, appId), eq(manifestRevisions.id, revisionId)))
    .get();
  if (!row) throw notFound();
  return manifestRevisionRecord(row);
}

export async function pushManifest(
  db: AppDatabase,
  appId: string,
  input: unknown,
  source: "push" | "sync" = "push",
): Promise<unknown> {
  const app = await getAppRow(db, appId);
  const manifest = AppManifestSchema.parse(input);
  if (manifest.app.key !== app.key || manifest.app.type !== app.type) {
    const errors = [
      ...(manifest.app.key !== app.key
        ? [{ path: "app.key", message: "Must match the App key" }]
        : []),
      ...(manifest.app.type !== app.type
        ? [{ path: "app.type", message: "Must match the App type" }]
        : []),
    ];
    throw validation("Manifest app identity does not match the target App", errors);
  }
  const manifestJson = stableJson(manifest);
  const checksum = await sha256(manifestJson);
  const existing = await db
    .select()
    .from(manifestRevisions)
    .where(and(eq(manifestRevisions.appId, appId), eq(manifestRevisions.checksum, checksum)))
    .get();
  if (existing) {
    if (app.activeManifestRevisionId === existing.id)
      return { manifest, revision: manifestRevisionRecord(existing), unchanged: true };
    const timestamp = nowIso();
    await db
      .update(apps)
      .set({ activeManifestRevisionId: existing.id, updatedAt: timestamp })
      .where(eq(apps.id, appId))
      .run();
    return { manifest, revision: manifestRevisionRecord(existing), unchanged: false };
  }
  const timestamp = nowIso();
  const row = {
    id: newId("manifest"),
    appId,
    protocolVersion: manifest.protocolVersion,
    appKey: manifest.app.key,
    manifestJson,
    checksum,
    source,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.transaction(async (tx) => {
    await tx.insert(manifestRevisions).values(row).run();
    await tx
      .update(apps)
      .set({ activeManifestRevisionId: row.id, updatedAt: timestamp })
      .where(eq(apps.id, appId))
      .run();
  });
  return { manifest, revision: manifestRevisionRecord(row), unchanged: false };
}

export async function syncManifest(db: AppDatabase, appId: string): Promise<unknown> {
  const app = await getAppRow(db, appId);
  if (!app.manifestUrl) throw validation("This App has no configured manifest URL");
  const url = assertSafeRemoteUrl(app.manifestUrl);
  let response: Response;
  try {
    response = await fetch(url, { redirect: "error", headers: { accept: "application/json" } });
  } catch {
    throw unavailable("Manifest URL could not be reached");
  }
  if (!response.ok) throw unavailable("Manifest URL returned an unsuccessful response");
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw validation("Manifest response is not valid JSON");
  }
  return pushManifest(db, appId, payload, "sync");
}

export async function listResources(
  db: AppDatabase,
  appId: string,
  kind: ResourceKind,
  query: URLSearchParams,
): Promise<{ items: unknown[]; nextCursor: string | null }> {
  await getAppRow(db, appId);
  const parsed = PaginationQuerySchema.parse(Object.fromEntries(query.entries()));
  const table = kind === "page" ? pages : templates;
  const filters = [eq(table.appId, appId)];
  if (parsed.status) filters.push(eq(table.status, parsed.status));
  if (parsed.categoryId) filters.push(eq(table.categoryId, parsed.categoryId));
  if (parsed.q)
    filters.push(or(like(table.key, `%${parsed.q}%`), like(table.title, `%${parsed.q}%`)) as never);
  const rows = await db
    .select()
    .from(table)
    .where(and(...filters))
    .orderBy(asc(table.createdAt), asc(table.id))
    .all();
  const offset = decodeCursor(parsed.cursor ?? null);
  return {
    items: rows.slice(offset, offset + parsed.limit).map(resourceRecord),
    nextCursor: offset + parsed.limit < rows.length ? encodeCursor(offset + parsed.limit) : null,
  };
}

export async function createResource(
  db: AppDatabase,
  appId: string,
  kind: ResourceKind,
  input: unknown,
): Promise<unknown> {
  const app = await getAppRow(db, appId);
  if (app.status === "disabled") throw conflict("Disabled Apps cannot create new resources");
  const body = ResourceCreateSchema.parse(input);
  if (kind === "template" && body.status === "active") {
    throw validation(
      "Templates only support draft, disabled, and published statuses. Active status is not supported for templates.",
      [{ path: "status", message: "Invalid status for template" }],
    );
  }
  if (body.categoryId) await getCategoryRow(db, appId, body.categoryId);
  let initialDocument: SceneDocument = EmptyDocument;
  if (body.sourceTemplate) {
    if (kind !== "page") throw validation("Only Pages can be initialized from a Template");
    const template = await getResourceRow(db, appId, "template", body.sourceTemplate.templateId);
    if (template.status !== "published") {
      throw validation(
        "Only published templates can be used to create pages. Draft and disabled templates cannot be used.",
        [{ path: "sourceTemplate.templateId", message: "Template is not published" }],
      );
    }
    let documentJson: string | null = null;
    let resolvedVersionId: string | null = body.sourceTemplate.versionId ?? null;
    if (resolvedVersionId) {
      const version = await db
        .select()
        .from(documentVersions)
        .where(
          and(
            eq(documentVersions.appId, appId),
            eq(documentVersions.id, resolvedVersionId),
            eq(documentVersions.documentId, template.documentId),
          ),
        )
        .get();
      if (!version) throw notFound();
      documentJson = version.documentJson;
    } else if ("currentVersionId" in template && template.currentVersionId) {
      const version = await db
        .select()
        .from(documentVersions)
        .where(
          and(
            eq(documentVersions.appId, appId),
            eq(documentVersions.id, template.currentVersionId as string),
            eq(documentVersions.documentId, template.documentId),
          ),
        )
        .get();
      if (version) {
        documentJson = version.documentJson;
        resolvedVersionId = version.id;
      } else {
        const templateDoc = await getDocumentRow(db, appId, template.documentId);
        documentJson = templateDoc.draftJson;
      }
    } else {
      const templateDoc = await getDocumentRow(db, appId, template.documentId);
      documentJson = templateDoc.draftJson;
    }
    body.sourceTemplate.versionId = resolvedVersionId;
    initialDocument = parseJson(SceneDocumentSchema, documentJson);
  }
  const resourceId = newId(kind);
  const documentId = newId("document");
  const timestamp = nowIso();
  const resource = {
    id: resourceId,
    appId,
    key: body.key,
    title: body.title,
    description: body.description,
    categoryId: body.categoryId,
    documentId,
    status: body.status,
    defaultPromptId: kind === "page" ? (body.defaultPromptId ?? null) : null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const persistedResource = body.sourceTemplate
    ? {
        ...resource,
        sourceTemplateId: body.sourceTemplate.templateId,
        sourceTemplateVersionId: body.sourceTemplate.versionId ?? null,
      }
    : resource;
  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(documents)
        .values({
          id: documentId,
          appId,
          resourceKind: kind,
          resourceId,
          schemaVersion: initialDocument.schemaVersion,
          revision: 0,
          draftJson: stableJson(initialDocument),
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
      if (kind === "page") await tx.insert(pages).values(persistedResource).run();
      else
        await tx
          .insert(templates)
          .values({
            ...resource,
            status: body.status as "draft" | "disabled" | "published",
          })
          .run();
    });
  } catch (error) {
    if (isConstraintError(error))
      throw conflict(`${kind} key already exists`, [
        { path: "key", message: "Key already exists" },
      ]);
    throw error;
  }
  return ResourceSchema.parse(resourceRecord(persistedResource));
}

export async function getResource(
  db: AppDatabase,
  appId: string,
  kind: ResourceKind,
  resourceId: string,
): Promise<unknown> {
  return ResourceSchema.parse(resourceRecord(await getResourceRow(db, appId, kind, resourceId)));
}

export async function updateResource(
  db: AppDatabase,
  appId: string,
  kind: ResourceKind,
  resourceId: string,
  input: unknown,
): Promise<unknown> {
  const existing = await getResourceRow(db, appId, kind, resourceId);
  const body = ResourcePatchSchema.parse(input);
  if (kind === "template" && body.status === "active") {
    throw validation(
      "Templates only support draft, disabled, and published statuses. Active status is not supported for templates.",
      [{ path: "status", message: "Invalid status for template" }],
    );
  }
  if (body.categoryId) await getCategoryRow(db, appId, body.categoryId);
  if (kind === "template" && body.currentVersionId) {
    const version = await db
      .select({ id: documentVersions.id })
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.appId, appId),
          eq(documentVersions.documentId, existing.documentId),
          eq(documentVersions.id, body.currentVersionId),
        ),
      )
      .get();
    if (!version) throw notFound();
  }
  const table = kind === "page" ? pages : templates;
  await db
    .update(table)
    .set({
      title: body.title ?? existing.title,
      description: body.description ?? existing.description,
      categoryId: body.categoryId === undefined ? existing.categoryId : body.categoryId,
      status: (body.status ?? existing.status) as "draft" | "disabled" | "published",
      ...(kind === "page"
        ? {
            defaultPromptId:
              body.defaultPromptId !== undefined
                ? body.defaultPromptId
                : "defaultPromptId" in existing
                  ? (existing.defaultPromptId as string | null)
                  : null,
          }
        : {
            currentVersionId:
              body.currentVersionId !== undefined
                ? body.currentVersionId
                : "currentVersionId" in existing
                  ? (existing.currentVersionId as string | null)
                  : null,
          }),
      updatedAt: nowIso(),
    })
    .where(and(eq(table.appId, appId), eq(table.id, resourceId)))
    .run();
  return ResourceSchema.parse(resourceRecord(await getResourceRow(db, appId, kind, resourceId)));
}

export async function deleteResource(
  db: AppDatabase,
  appId: string,
  kind: ResourceKind,
  resourceId: string,
): Promise<void> {
  const resource = await getResourceRow(db, appId, kind, resourceId);
  const activeRelease = await db
    .select({ id: releases.id })
    .from(releases)
    .where(
      and(
        eq(releases.appId, appId),
        eq(releases.documentId, resource.documentId),
        eq(releases.status, "active"),
      ),
    )
    .limit(1)
    .get();
  if (activeRelease) throw conflict("Resource has active releases and cannot be deleted");

  const table = kind === "page" ? pages : templates;
  await db.transaction(async (tx) => {
    if (kind === "template") {
      await tx
        .update(pages)
        .set({ sourceTemplateId: null, sourceTemplateVersionId: null })
        .where(and(eq(pages.appId, appId), eq(pages.sourceTemplateId, resourceId)))
        .run();
    }
    await tx
      .delete(releases)
      .where(and(eq(releases.appId, appId), eq(releases.documentId, resource.documentId)))
      .run();
    await tx
      .delete(documentVersions)
      .where(
        and(
          eq(documentVersions.appId, appId),
          eq(documentVersions.documentId, resource.documentId),
        ),
      )
      .run();
    await tx
      .delete(table)
      .where(and(eq(table.appId, appId), eq(table.id, resourceId)))
      .run();
    await tx
      .delete(documents)
      .where(and(eq(documents.appId, appId), eq(documents.id, resource.documentId)))
      .run();
  });
}
export async function getDocument(
  db: AppDatabase,
  appId: string,
  documentId: string,
): Promise<unknown> {
  const row = await getDocumentRow(db, appId, documentId);
  return DocumentSchema.parse(documentRecord(row));
}

export async function getDraft(
  db: AppDatabase,
  appId: string,
  documentId: string,
): Promise<unknown> {
  const row = await getDocumentRow(db, appId, documentId);
  return { revision: row.revision, document: parseJson(SceneDocumentSchema, row.draftJson) };
}

export async function updateDraft(
  db: AppDatabase,
  appId: string,
  documentId: string,
  input: unknown,
  ifMatch?: string | null,
): Promise<unknown> {
  const body = DraftPatchSchema.parse(input);
  const row = await getDocumentRow(db, appId, documentId);
  const expectedRevision = body.baseRevision ?? parseEtag(ifMatch);
  if (expectedRevision === undefined)
    throw validation("Draft updates require baseRevision or If-Match");
  if (expectedRevision !== row.revision)
    throw conflict(
      `Expected revision ${expectedRevision} but current revision is ${row.revision}`,
      [{ path: "currentRevision", message: String(row.revision) }],
    );
  const document = SceneDocumentSchema.parse(body.document);
  const nextRevision = row.revision + 1;
  const result = await db
    .update(documents)
    .set({
      schemaVersion: document.schemaVersion,
      revision: nextRevision,
      draftJson: stableJson(document),
      updatedAt: nowIso(),
    })
    .where(
      and(
        eq(documents.appId, appId),
        eq(documents.id, documentId),
        eq(documents.revision, expectedRevision),
      ),
    )
    .run();
  if (result.rowsAffected !== 1)
    throw conflict("Draft was changed by another editor", [
      { path: "currentRevision", message: "unknown" },
    ]);
  return { revision: nextRevision, document };
}

export async function listVersions(
  db: AppDatabase,
  appId: string,
  documentId: string,
): Promise<unknown[]> {
  await getDocumentRow(db, appId, documentId);
  const rows = await db
    .select()
    .from(documentVersions)
    .where(and(eq(documentVersions.appId, appId), eq(documentVersions.documentId, documentId)))
    .orderBy(desc(documentVersions.versionNumber))
    .all();
  return rows.map(versionRecord);
}

export async function createVersion(
  db: AppDatabase,
  appId: string,
  documentId: string,
  input: unknown,
): Promise<unknown> {
  const body = VersionCreateSchema.parse(input);
  const document = await getDocumentRow(db, appId, documentId);
  const canonicalDocument = parseJson(SceneDocumentSchema, document.draftJson);
  if (body.sourceRevision !== undefined && body.sourceRevision !== document.revision)
    throw conflict(
      `Expected revision ${body.sourceRevision} but current revision is ${document.revision}`,
      [{ path: "currentRevision", message: String(document.revision) }],
    );
  const latest = await db
    .select({ versionNumber: documentVersions.versionNumber })
    .from(documentVersions)
    .where(and(eq(documentVersions.appId, appId), eq(documentVersions.documentId, documentId)))
    .orderBy(desc(documentVersions.versionNumber))
    .limit(1)
    .get();
  const version = {
    id: newId("version"),
    appId,
    documentId,
    versionNumber: (latest?.versionNumber ?? 0) + 1,
    documentJson: stableJson(canonicalDocument),
    sourceRevision: document.revision,
    message: body.message,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.insert(documentVersions).values(version).run();
  if (document.resourceKind === "template") {
    const template = await db
      .select({ id: templates.id, currentVersionId: templates.currentVersionId })
      .from(templates)
      .where(and(eq(templates.appId, appId), eq(templates.id, document.resourceId)))
      .get();
    if (template && !template.currentVersionId) {
      await db
        .update(templates)
        .set({ currentVersionId: version.id, updatedAt: version.updatedAt })
        .where(eq(templates.id, template.id))
        .run();
    }
  }
  return VersionSchema.parse(versionRecord(version));
}
export async function getVersion(
  db: AppDatabase,
  appId: string,
  documentId: string,
  versionId: string,
): Promise<unknown> {
  const row = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.appId, appId),
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.id, versionId),
      ),
    )
    .get();
  if (!row) throw notFound();
  return VersionSchema.parse(versionRecord(row));
}
export async function deleteVersion(
  db: AppDatabase,
  appId: string,
  documentId: string,
  versionId: string,
): Promise<void> {
  const document = await getDocumentRow(db, appId, documentId);
  const row = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.appId, appId),
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.id, versionId),
      ),
    )
    .get();
  if (!row) throw notFound();

  const releaseRef = await db
    .select({ id: releases.id })
    .from(releases)
    .where(and(eq(releases.appId, appId), eq(releases.versionId, versionId)))
    .limit(1)
    .get();
  if (releaseRef) {
    throw conflict("Version is referenced by a Release and cannot be deleted");
  }

  const pageRef = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.appId, appId), eq(pages.sourceTemplateVersionId, versionId)))
    .limit(1)
    .get();
  if (pageRef) {
    throw conflict("Version is referenced by a Page and cannot be deleted");
  }

  if (document.resourceKind === "template") {
    const template = await db
      .select({ id: templates.id, currentVersionId: templates.currentVersionId })
      .from(templates)
      .where(and(eq(templates.appId, appId), eq(templates.id, document.resourceId)))
      .get();
    if (template && template.currentVersionId === versionId) {
      throw conflict(
        "Current version of the template cannot be deleted. Please set another version as the current version first.",
      );
    }
  }

  await db
    .delete(documentVersions)
    .where(
      and(
        eq(documentVersions.appId, appId),
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.id, versionId),
      ),
    )
    .run();
}

export async function listReleases(
  db: AppDatabase,
  appId: string,
  documentId: string,
): Promise<unknown[]> {
  await getDocumentRow(db, appId, documentId);
  const rows = await db
    .select()
    .from(releases)
    .where(and(eq(releases.appId, appId), eq(releases.documentId, documentId)))
    .orderBy(desc(releases.createdAt))
    .all();
  return rows.map(releaseRecord);
}

export async function createRelease(
  db: AppDatabase,
  appId: string,
  documentId: string,
  input: unknown,
): Promise<unknown> {
  const body = ReleaseCreateSchema.parse(input);
  const app = await getAppRow(db, appId);
  if (app.status === "disabled") throw conflict("Disabled Apps cannot create Releases");
  const document = await getDocumentRow(db, appId, documentId);
  if (document.resourceKind === "template") {
    throw validation("Templates cannot be published. Releases are only supported for Pages.");
  }
  const version = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.appId, appId),
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.id, body.versionId),
      ),
    )
    .get();
  if (!version) throw notFound();
  const releaseId = newId("release");
  const key = releaseObjectKey(appId, releaseId);
  const releaseDocument = parseJson(SceneDocumentSchema, version.documentJson);
  const storage = await getAppStorage(db, appId);
  await storage.put(
    key,
    new TextEncoder().encode(
      stableJson({
        schemaVersion: releaseDocument.schemaVersion,
        document: releaseDocument,
        versionId: version.id,
      }),
    ),
    "application/json",
  );
  const timestamp = nowIso();
  const row = {
    id: releaseId,
    appId,
    documentId: document.id,
    versionId: version.id,
    channel: body.channel,
    status: "active" as const,
    storageKey: key,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.transaction(async (tx) => {
    await tx
      .update(releases)
      .set({ status: "superseded", updatedAt: timestamp })
      .where(
        and(
          eq(releases.appId, appId),
          eq(releases.documentId, documentId),
          eq(releases.channel, body.channel),
          eq(releases.status, "active"),
        ),
      )
      .run();
    await tx.insert(releases).values(row).run();
  });
  return ReleaseSchema.parse(releaseRecord(row));
}

export async function getRelease(
  db: AppDatabase,
  appId: string,
  releaseId: string,
): Promise<unknown> {
  const row = await db
    .select()
    .from(releases)
    .where(and(eq(releases.appId, appId), eq(releases.id, releaseId)))
    .get();
  if (!row) throw notFound();
  return ReleaseSchema.parse(releaseRecord(row));
}

export async function listCategories(db: AppDatabase, appId: string): Promise<unknown[]> {
  await getAppRow(db, appId);
  return (
    await db
      .select()
      .from(categories)
      .where(eq(categories.appId, appId))
      .orderBy(asc(categories.createdAt))
      .all()
  ).map(categoryRecord);
}

export async function createCategory(
  db: AppDatabase,
  appId: string,
  input: unknown,
): Promise<unknown> {
  await getAppRow(db, appId);
  const body = CategoryCreateSchema.parse(input);
  const timestamp = nowIso();
  const row = {
    id: newId("category"),
    appId,
    scope: body.scope,
    key: body.key,
    name: body.name,
    isDefault: body.isDefault,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  try {
    await db.transaction(async (tx) => {
      if (body.isDefault)
        await tx
          .update(categories)
          .set({ isDefault: false, updatedAt: timestamp })
          .where(and(eq(categories.appId, appId), eq(categories.scope, body.scope)))
          .run();
      await tx.insert(categories).values(row).run();
    });
  } catch (error) {
    if (isConstraintError(error)) throw conflict("Category key already exists");
    throw error;
  }
  return CategorySchema.parse(categoryRecord(row));
}

export async function getCategory(
  db: AppDatabase,
  appId: string,
  categoryId: string,
): Promise<unknown> {
  return CategorySchema.parse(categoryRecord(await getCategoryRow(db, appId, categoryId)));
}

export async function updateCategory(
  db: AppDatabase,
  appId: string,
  categoryId: string,
  input: unknown,
): Promise<unknown> {
  const existing = await getCategoryRow(db, appId, categoryId);
  const body = CategoryPatchSchema.parse(input);
  const timestamp = nowIso();
  await db.transaction(async (tx) => {
    if (body.isDefault)
      await tx
        .update(categories)
        .set({ isDefault: false, updatedAt: timestamp })
        .where(and(eq(categories.appId, appId), eq(categories.scope, body.scope ?? existing.scope)))
        .run();
    await tx
      .update(categories)
      .set({
        scope: body.scope ?? existing.scope,
        name: body.name ?? existing.name,
        isDefault: body.isDefault ?? existing.isDefault,
        updatedAt: timestamp,
      })
      .where(and(eq(categories.appId, appId), eq(categories.id, categoryId)))
      .run();
  });
  return CategorySchema.parse(categoryRecord(await getCategoryRow(db, appId, categoryId)));
}

export async function deleteCategory(
  db: AppDatabase,
  appId: string,
  categoryId: string,
): Promise<void> {
  const row = await getCategoryRow(db, appId, categoryId);
  if (row.isDefault) throw conflict("The default Category cannot be deleted");
  const used = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.appId, appId), eq(pages.categoryId, categoryId)))
    .limit(1)
    .get();
  const templateUsed = await db
    .select({ id: templates.id })
    .from(templates)
    .where(and(eq(templates.appId, appId), eq(templates.categoryId, categoryId)))
    .limit(1)
    .get();
  if (used || templateUsed) throw conflict("Category is referenced by a resource");
  await db
    .delete(categories)
    .where(and(eq(categories.appId, appId), eq(categories.id, categoryId)))
    .run();
}

export async function listLocales(db: AppDatabase, appId: string): Promise<unknown[]> {
  await getAppRow(db, appId);
  return (
    await db
      .select()
      .from(locales)
      .where(eq(locales.appId, appId))
      .orderBy(asc(locales.createdAt))
      .all()
  ).map(localeRecord);
}

export async function createLocale(
  db: AppDatabase,
  appId: string,
  input: unknown,
): Promise<unknown> {
  await getAppRow(db, appId);
  const body = LocaleCreateSchema.parse(input);
  const timestamp = nowIso();
  const row = {
    id: newId("locale"),
    appId,
    code: body.code.toLowerCase(),
    name: body.name,
    isDefault: body.isDefault,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  try {
    await db.transaction(async (tx) => {
      if (body.isDefault)
        await tx
          .update(locales)
          .set({ isDefault: false, updatedAt: timestamp })
          .where(eq(locales.appId, appId))
          .run();
      await tx.insert(locales).values(row).run();
    });
  } catch (error) {
    if (isConstraintError(error)) throw conflict("Locale code already exists");
    throw error;
  }
  return LocaleSchema.parse(localeRecord(row));
}

export async function getLocale(
  db: AppDatabase,
  appId: string,
  localeId: string,
): Promise<unknown> {
  const row = await db
    .select()
    .from(locales)
    .where(and(eq(locales.appId, appId), eq(locales.id, localeId)))
    .get();
  if (!row) throw notFound();
  return LocaleSchema.parse(localeRecord(row));
}

export async function updateLocale(
  db: AppDatabase,
  appId: string,
  localeId: string,
  input: unknown,
): Promise<unknown> {
  const existing = await db
    .select()
    .from(locales)
    .where(and(eq(locales.appId, appId), eq(locales.id, localeId)))
    .get();
  if (!existing) throw notFound();
  const body = LocalePatchSchema.parse(input);
  const timestamp = nowIso();
  await db.transaction(async (tx) => {
    if (body.isDefault)
      await tx
        .update(locales)
        .set({ isDefault: false, updatedAt: timestamp })
        .where(eq(locales.appId, appId))
        .run();
    await tx
      .update(locales)
      .set({
        name: body.name ?? existing.name,
        isDefault: body.isDefault ?? existing.isDefault,
        updatedAt: timestamp,
      })
      .where(and(eq(locales.appId, appId), eq(locales.id, localeId)))
      .run();
  });
  return getLocale(db, appId, localeId);
}

export async function deleteLocale(
  db: AppDatabase,
  appId: string,
  localeId: string,
): Promise<void> {
  const row = await db
    .select()
    .from(locales)
    .where(and(eq(locales.appId, appId), eq(locales.id, localeId)))
    .get();
  if (!row) throw notFound();
  if (row.isDefault) throw conflict("The default Locale cannot be deleted");
  await db
    .delete(locales)
    .where(and(eq(locales.appId, appId), eq(locales.id, localeId)))
    .run();
}
export async function listAppOpenApiDocs(db: AppDatabase, appId: string): Promise<unknown[]> {
  await getAppRow(db, appId);
  return (
    await db
      .select()
      .from(appOpenApiDocs)
      .where(eq(appOpenApiDocs.appId, appId))
      .orderBy(asc(appOpenApiDocs.createdAt))
      .all()
  ).map(openApiDocRecord);
}

export async function createAppOpenApiDoc(
  db: AppDatabase,
  appId: string,
  input: unknown,
): Promise<unknown> {
  await getAppRow(db, appId);
  const body = OpenApiDocCreateSchema.parse(input);
  const timestamp = nowIso();
  const row = {
    id: newId("openapi"),
    appId,
    name: body.name,
    json: JSON.stringify(body.json),
    isDefault: body.isDefault ?? false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.transaction(async (tx) => {
    if (row.isDefault)
      await tx
        .update(appOpenApiDocs)
        .set({ isDefault: false, updatedAt: timestamp })
        .where(eq(appOpenApiDocs.appId, appId))
        .run();
    await tx.insert(appOpenApiDocs).values(row).run();
  });
  return OpenApiDocSchema.parse(openApiDocRecord(row));
}

export async function getAppOpenApiDoc(
  db: AppDatabase,
  appId: string,
  docId: string,
): Promise<unknown> {
  const row = await db
    .select()
    .from(appOpenApiDocs)
    .where(and(eq(appOpenApiDocs.appId, appId), eq(appOpenApiDocs.id, docId)))
    .get();
  if (!row) throw notFound();
  return OpenApiDocSchema.parse(openApiDocRecord(row));
}

export async function updateAppOpenApiDoc(
  db: AppDatabase,
  appId: string,
  docId: string,
  input: unknown,
): Promise<unknown> {
  const existing = await db
    .select()
    .from(appOpenApiDocs)
    .where(and(eq(appOpenApiDocs.appId, appId), eq(appOpenApiDocs.id, docId)))
    .get();
  if (!existing) throw notFound();
  const body = OpenApiDocPatchSchema.parse(input);
  const timestamp = nowIso();
  await db.transaction(async (tx) => {
    if (body.isDefault)
      await tx
        .update(appOpenApiDocs)
        .set({ isDefault: false, updatedAt: timestamp })
        .where(eq(appOpenApiDocs.appId, appId))
        .run();
    await tx
      .update(appOpenApiDocs)
      .set({
        name: body.name ?? existing.name,
        json: body.json !== undefined ? JSON.stringify(body.json) : existing.json,
        isDefault: body.isDefault ?? existing.isDefault,
        updatedAt: timestamp,
      })
      .where(and(eq(appOpenApiDocs.appId, appId), eq(appOpenApiDocs.id, docId)))
      .run();
  });
  return getAppOpenApiDoc(db, appId, docId);
}

export async function deleteAppOpenApiDoc(
  db: AppDatabase,
  appId: string,
  docId: string,
): Promise<void> {
  const row = await db
    .select()
    .from(appOpenApiDocs)
    .where(and(eq(appOpenApiDocs.appId, appId), eq(appOpenApiDocs.id, docId)))
    .get();
  if (!row) throw notFound();
  if (row.isDefault) throw conflict("The default OpenAPI document cannot be deleted");
  await db
    .delete(appOpenApiDocs)
    .where(and(eq(appOpenApiDocs.appId, appId), eq(appOpenApiDocs.id, docId)))
    .run();
}

export async function listAssets(db: AppDatabase, appId: string): Promise<unknown[]> {
  await getAppRow(db, appId);
  return (
    await db
      .select()
      .from(assets)
      .where(eq(assets.appId, appId))
      .orderBy(desc(assets.createdAt))
      .all()
  ).map(assetRecord);
}

export async function getAsset(db: AppDatabase, appId: string, assetId: string): Promise<unknown> {
  const row = await db
    .select()
    .from(assets)
    .where(and(eq(assets.appId, appId), eq(assets.id, assetId)))
    .get();
  if (!row) throw notFound();
  return AssetSchema.parse(assetRecord(row));
}

export async function createUploadIntent(
  db: AppDatabase,
  appId: string,
  input: unknown,
): Promise<unknown> {
  await getAppRow(db, appId);
  const body = UploadIntentSchema.parse(input);
  const config = getConfig();
  if (body.size > config.security.maxUploadBytes)
    throw payloadTooLarge(`Upload exceeds the ${config.security.maxUploadBytes} byte limit`);
  if (!config.security.allowedMimeTypes.includes(body.mimeType))
    throw validation("MIME type is not allowed", [{ path: "mimeType", message: body.mimeType }]);
  const assetId = newId("asset");
  const key = assetObjectKey(appId, assetId, body.fileName);
  const timestamp = nowIso();
  const storage = await getAppStorage(db, appId);
  const upload = await storage.createUploadIntent({
    key,
    mimeType: body.mimeType,
    size: body.size,
    expiresInSeconds: 900,
  });
  const row = {
    id: assetId,
    appId,
    status: "pending" as const,
    fileName: body.fileName,
    mimeType: body.mimeType,
    size: body.size,
    storageKey: key,
    checksum: null,
    width: null,
    height: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.insert(assets).values(row).run();
  return {
    asset: AssetSchema.parse(assetRecord(row)),
    uploadUrl: upload.url,
    expiresAt: upload.expiresAt,
  };
}

export async function completeAsset(
  db: AppDatabase,
  appId: string,
  assetId: string,
  input: unknown,
): Promise<unknown> {
  const body = AssetCompleteSchema.parse(input);
  const row = await db
    .select()
    .from(assets)
    .where(and(eq(assets.appId, appId), eq(assets.id, assetId)))
    .get();
  if (!row) throw notFound();
  const storage = await getAppStorage(db, appId);
  const head = await storage.head(row.storageKey);
  if (!head) throw conflict("Uploaded object was not found");
  if (head.size !== row.size || head.mimeType !== row.mimeType)
    throw conflict("Uploaded object does not match the declared size or MIME type");
  await db
    .update(assets)
    .set({
      status: "ready",
      checksum: body.checksum ?? head.checksum ?? null,
      width: body.width ?? null,
      height: body.height ?? null,
      updatedAt: nowIso(),
    })
    .where(and(eq(assets.appId, appId), eq(assets.id, assetId)))
    .run();
  return getAsset(db, appId, assetId);
}

export async function deleteAsset(db: AppDatabase, appId: string, assetId: string): Promise<void> {
  const row = await db
    .select()
    .from(assets)
    .where(and(eq(assets.appId, appId), eq(assets.id, assetId)))
    .get();
  if (!row) throw notFound();
  const marker = `"assetId":"${assetId}"`;
  const [drafts, versions] = await Promise.all([
    db
      .select({ json: documents.draftJson })
      .from(documents)
      .where(eq(documents.appId, appId))
      .all(),
    db
      .select({ json: documentVersions.documentJson })
      .from(documentVersions)
      .where(eq(documentVersions.appId, appId))
      .all(),
  ]);
  if ([...drafts, ...versions].some((item) => item.json.includes(marker)))
    throw conflict("Asset is referenced by a Document or Version");
  const storage = await getAppStorage(db, appId);
  await storage.delete(row.storageKey);
  await db
    .delete(assets)
    .where(and(eq(assets.appId, appId), eq(assets.id, assetId)))
    .run();
}

export async function createStudioSession(
  db: AppDatabase,
  appId: string,
  input: unknown,
): Promise<unknown> {
  const app = await getAppRow(db, appId);
  if (app.status === "disabled") throw conflict("Disabled Apps cannot create Studio Sessions");
  const body = StudioSessionCreateSchema.parse(input);
  const resource = await getResourceRow(db, appId, body.resourceKind, body.resourceId);
  const profile = await getPreviewRow(db, appId, body.previewProfileId);
  const token = newSecret("session");
  const timestamp = nowIso();
  const expiresAt = new Date(
    Date.now() + getConfig().studio.sessionTtlSeconds * 1_000,
  ).toISOString();
  const row = {
    id: newId("session"),
    appId,
    resourceKind: body.resourceKind,
    resourceId: resource.id,
    previewProfileId: profile.id,
    returnUrl: body.returnUrl,
    tokenHash: hashSecret(token),
    expiresAt,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.insert(studioSessions).values(row).run();
  const config = getConfig();
  const studioBaseUrl = config.studio.publicBaseUrl.replace(/\/$/, "");
  const serverUrl = encodeURIComponent(config.api.publicBaseUrl);
  return {
    id: row.id,
    token,
    expiresAt,
    resourceKind: row.resourceKind,
    resourceId: row.resourceId,
    launchUrl: `${studioBaseUrl}?server-url=${serverUrl}&sessionId=${encodeURIComponent(row.id)}#token=${encodeURIComponent(token)}`,
  };
}

export async function getResourceChatSessions(
  db: AppDatabase,
  appId: string,
  resourceKind: "page" | "template",
  resourceId: string,
): Promise<unknown[]> {
  const row = await db
    .select()
    .from(aiChatSessions)
    .where(
      and(
        eq(aiChatSessions.appId, appId),
        eq(aiChatSessions.resourceKind, resourceKind),
        eq(aiChatSessions.resourceId, resourceId),
      ),
    )
    .get();

  if (!row) return [];
  try {
    const parsed = JSON.parse(row.json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveResourceChatSessions(
  db: AppDatabase,
  appId: string,
  resourceKind: "page" | "template",
  resourceId: string,
  sessions: unknown,
): Promise<unknown[]> {
  const timestamp = nowIso();
  const jsonStr = JSON.stringify(Array.isArray(sessions) ? sessions : []);
  const id = `asess_${appId}_${resourceKind}_${resourceId}`;

  await db
    .insert(aiChatSessions)
    .values({
      id,
      appId,
      resourceKind,
      resourceId,
      json: jsonStr,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: [aiChatSessions.appId, aiChatSessions.resourceKind, aiChatSessions.resourceId],
      set: {
        json: jsonStr,
        updatedAt: timestamp,
      },
    })
    .run();

  return getResourceChatSessions(db, appId, resourceKind, resourceId);
}

export async function bootstrapStudioSession(db: AppDatabase, sessionId: string): Promise<unknown> {
  const session = await db
    .select()
    .from(studioSessions)
    .where(eq(studioSessions.id, sessionId))
    .get();
  if (!session) throw notFound();
  if (new Date(session.expiresAt).getTime() <= Date.now()) throw new ProblemSessionExpired();
  const app = await getAppRow(db, session.appId);
  const resource = await getResourceRow(
    db,
    session.appId,
    session.resourceKind,
    session.resourceId,
  );
  const document = await getDocumentRow(db, session.appId, resource.documentId);
  const profile = await getPreviewRow(db, session.appId, session.previewProfileId);
  const manifestResult = z
    .object({ manifest: AppManifestSchema.nullable() })
    .passthrough()
    .parse(await getManifest(db, session.appId));
  const allowedOrigin = JSON.parse(profile.allowedOriginsJson) as unknown;
  const origins = z.array(z.string()).parse(allowedOrigin);
  return {
    session: { id: session.id, expiresAt: session.expiresAt },
    app: { id: app.id, key: app.key, name: app.name, type: app.type },
    resource: {
      id: resource.id,
      kind: session.resourceKind,
      title: resource.title,
      documentId: resource.documentId,
      defaultPromptId:
        "defaultPromptId" in resource
          ? ((resource as Record<string, unknown>).defaultPromptId as string | null)
          : null,
    },
    draft: {
      revision: document.revision,
      document: parseJson(SceneDocumentSchema, document.draftJson),
    },
    manifest: manifestResult.manifest,
    preview: { url: profile.url, allowedOrigin: origins[0], profileId: profile.id },
    capabilities: {
      saveDraft: true,
      createVersion: true,
      publish: session.resourceKind !== "template",
      uploadAsset: true,
    },
    returnUrl: session.returnUrl,
    prompts: await listAppPrompts(db, session.appId),
    locales: await listLocales(db, session.appId),
    chatSessions: await getResourceChatSessions(
      db,
      session.appId,
      session.resourceKind,
      session.resourceId,
    ),
  };
}

export async function updateStudioDraft(
  db: AppDatabase,
  sessionId: string,
  input: unknown,
): Promise<unknown> {
  const session = await db
    .select()
    .from(studioSessions)
    .where(eq(studioSessions.id, sessionId))
    .get();
  if (!session) throw notFound();
  if (new Date(session.expiresAt).getTime() <= Date.now()) throw new ProblemSessionExpired();
  const resource = await getResourceRow(
    db,
    session.appId,
    session.resourceKind,
    session.resourceId,
  );
  return updateDraft(db, session.appId, resource.documentId, input);
}

export async function runtimePage(
  db: AppDatabase,
  appKey: string,
  pageKey: string,
): Promise<{ payload: unknown; etag: string }> {
  const app = await db
    .select()
    .from(apps)
    .where(and(eq(apps.key, appKey), eq(apps.status, "active")))
    .get();
  if (!app) throw notFound();
  const page = await db
    .select()
    .from(pages)
    .where(and(eq(pages.appId, app.id), eq(pages.key, pageKey), eq(pages.status, "published")))
    .get();
  if (!page) throw notFound();
  const document = await getDocumentRow(db, app.id, page.documentId);
  const release = await db
    .select()
    .from(releases)
    .where(
      and(
        eq(releases.appId, app.id),
        eq(releases.documentId, document.id),
        eq(releases.channel, "production"),
        eq(releases.status, "active"),
      ),
    )
    .orderBy(desc(releases.createdAt))
    .limit(1)
    .get();
  if (!release) throw notFound();
  const version = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.appId, app.id),
        eq(documentVersions.id, release.versionId),
        eq(documentVersions.documentId, document.id),
      ),
    )
    .get();
  if (!version) throw notFound();
  const documentJson = parseJson(SceneDocumentSchema, version.documentJson);
  const payload = RuntimePageDeliverySchema.parse({
    app: { id: app.id, key: app.key, type: app.type },
    page: { id: page.id, key: page.key, title: page.title },
    release: releaseRecord(release),
    version: versionRecord(version),
    document: documentJson,
  });
  return { payload, etag: `"${version.id}-${version.sourceRevision}"` };
}

export async function runtimeRelease(
  db: AppDatabase,
  appKey: string,
  releaseId: string,
): Promise<{ payload: unknown; etag: string }> {
  const app = await db
    .select()
    .from(apps)
    .where(and(eq(apps.key, appKey), eq(apps.status, "active")))
    .get();
  if (!app) throw notFound();
  const release = await db
    .select()
    .from(releases)
    .where(
      and(eq(releases.appId, app.id), eq(releases.id, releaseId), eq(releases.status, "active")),
    )
    .get();
  if (!release) throw notFound();
  const version = await db
    .select()
    .from(documentVersions)
    .where(and(eq(documentVersions.appId, app.id), eq(documentVersions.id, release.versionId)))
    .get();
  if (!version) throw notFound();
  const page = await db
    .select()
    .from(pages)
    .where(and(eq(pages.appId, app.id), eq(pages.documentId, release.documentId)))
    .limit(1)
    .get();
  if (!page) throw notFound();
  const payload = RuntimePageDeliverySchema.parse({
    app: { id: app.id, key: app.key, type: app.type },
    page: { id: page.id, key: page.key, title: page.title },
    release: releaseRecord(release),
    version: versionRecord(version),
    document: parseJson(SceneDocumentSchema, version.documentJson),
  });
  return { payload, etag: `"${version.id}-${version.sourceRevision}"` };
}

export async function storageHealth(): Promise<unknown> {
  return {
    status: "deprecated",
    driver: "none",
    detail: "Global storage is deprecated. Storage is configured per app.",
  };
}

const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

export async function getAppStorageConfig(db: AppDatabase, appId: string): Promise<unknown> {
  await getAppRow(db, appId);
  const row = await db
    .select()
    .from(appStorageConfigs)
    .where(eq(appStorageConfigs.appId, appId))
    .get();
  if (!row) {
    return AppStorageConfigStatusSchema.parse({
      configured: false,
      config: {
        appId,
        driver: "database",
        endpoint: null,
        region: "auto",
        bucket: null,
        accessKeyId: null,
        hasSecretAccessKey: false,
        forcePathStyle: true,
        publicBaseUrl: null,
        createdAt: EPOCH_ISO,
        updatedAt: EPOCH_ISO,
      },
    });
  }
  return AppStorageConfigStatusSchema.parse({
    configured: true,
    config: {
      appId: row.appId,
      driver: row.driver,
      endpoint: row.endpoint ?? null,
      region: row.region ?? "auto",
      bucket: row.bucket ?? null,
      accessKeyId: row.accessKeyId ?? null,
      hasSecretAccessKey: Boolean(row.secretAccessKeyEnc),
      forcePathStyle: row.forcePathStyle,
      publicBaseUrl: row.publicBaseUrl ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
  });
}

export async function upsertAppStorageConfig(
  db: AppDatabase,
  appId: string,
  input: unknown,
): Promise<unknown> {
  await getAppRow(db, appId);
  const body = AppStorageConfigUpsertSchema.parse(input);
  const timestamp = nowIso();
  const existing = await db
    .select()
    .from(appStorageConfigs)
    .where(eq(appStorageConfigs.appId, appId))
    .get();

  const encryptionKey = getConfig().ai.encryptionKey;
  let secretAccessKeyEnc: string | null = null;
  let bucket: string | null = null;
  let accessKeyId: string | null = null;
  let endpoint: string | null = null;
  let region: string | null = "auto";
  let publicBaseUrl: string | null = null;
  const forcePathStyle = body.forcePathStyle ?? true;

  if (body.driver === "s3") {
    if (!body.bucket && !existing?.bucket) {
      throw validation("A bucket name is required to configure S3 storage", [
        { path: "bucket", message: "Bucket name is required" },
      ]);
    }
    if (!body.accessKeyId && !existing?.accessKeyId) {
      throw validation("An access key ID is required to configure S3 storage", [
        { path: "accessKeyId", message: "Access key ID is required" },
      ]);
    }
    bucket = body.bucket ?? existing?.bucket ?? null;
    accessKeyId = body.accessKeyId ?? existing?.accessKeyId ?? null;
    endpoint = body.endpoint ? body.endpoint : (existing?.endpoint ?? null);
    region = body.region ? body.region : (existing?.region ?? "auto");
    publicBaseUrl = body.publicBaseUrl ? body.publicBaseUrl : (existing?.publicBaseUrl ?? null);

    if (body.secretAccessKey) {
      secretAccessKeyEnc = encryptSecret(body.secretAccessKey, encryptionKey);
    } else if (existing?.secretAccessKeyEnc) {
      secretAccessKeyEnc = existing.secretAccessKeyEnc;
    } else {
      throw validation("A secret access key is required to configure S3 storage", [
        { path: "secretAccessKey", message: "Secret access key is required" },
      ]);
    }
  } else if (body.driver === "memory") {
    secretAccessKeyEnc = encryptSecret("memory-secret", encryptionKey);
    bucket = "memory";
    accessKeyId = "memory";
  }

  const values = {
    appId,
    driver: body.driver,
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKeyEnc,
    forcePathStyle,
    publicBaseUrl,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  await db
    .insert(appStorageConfigs)
    .values(values)
    .onConflictDoUpdate({
      target: appStorageConfigs.appId,
      set: {
        driver: values.driver,
        endpoint: values.endpoint,
        region: values.region,
        bucket: values.bucket,
        accessKeyId: values.accessKeyId,
        secretAccessKeyEnc: values.secretAccessKeyEnc,
        forcePathStyle: values.forcePathStyle,
        publicBaseUrl: values.publicBaseUrl,
        updatedAt: values.updatedAt,
      },
    })
    .run();

  invalidateAppStorage(appId);

  return AppStorageConfigSchema.parse({
    appId,
    driver: values.driver,
    endpoint: values.endpoint,
    region: values.region,
    bucket: values.bucket,
    accessKeyId: values.accessKeyId,
    hasSecretAccessKey: Boolean(values.secretAccessKeyEnc),
    forcePathStyle: values.forcePathStyle,
    publicBaseUrl: values.publicBaseUrl,
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
  });
}

export async function deleteAppStorageConfig(db: AppDatabase, appId: string): Promise<void> {
  await getAppRow(db, appId);
  await db.delete(appStorageConfigs).where(eq(appStorageConfigs.appId, appId)).run();
  invalidateAppStorage(appId);
}

export async function testAppStorage(
  db: AppDatabase,
  appId: string,
  input?: unknown,
): Promise<unknown> {
  await getAppRow(db, appId);
  const existing = await db
    .select()
    .from(appStorageConfigs)
    .where(eq(appStorageConfigs.appId, appId))
    .get();

  let body: Partial<z.infer<typeof AppStorageConfigUpsertSchema>> | undefined;
  if (input && typeof input === "object" && Object.keys(input).length > 0) {
    body = AppStorageConfigUpsertSchema.partial().parse(input);
  }
  const driver = body?.driver ?? existing?.driver ?? "database";
  if (driver === "database") {
    return AppStorageHealthSchema.parse({ status: "up", driver: "database" });
  }
  if (driver === "memory") {
    return AppStorageHealthSchema.parse({ status: "up", driver: "memory" });
  }

  const endpoint = body ? body.endpoint || undefined : (existing?.endpoint ?? undefined);
  const region = body?.region ?? existing?.region ?? "auto";
  const bucket = body?.bucket ?? existing?.bucket;
  const accessKeyId = body?.accessKeyId ?? existing?.accessKeyId;
  const forcePathStyle = body?.forcePathStyle ?? existing?.forcePathStyle ?? true;

  let secretAccessKey: string | undefined = body?.secretAccessKey || undefined;
  if (!secretAccessKey && existing?.secretAccessKeyEnc) {
    const encryptionKey = getConfig().ai.encryptionKey;
    secretAccessKey = decryptSecret(existing.secretAccessKeyEnc, encryptionKey);
  }

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return AppStorageHealthSchema.parse({
      status: "not_configured",
      driver: "s3",
      detail: "S3 bucket, access key ID, and secret access key are required for testing",
    });
  }

  const adapter = new S3StorageAdapter({
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle,
  });

  const health = await adapter.health();
  return AppStorageHealthSchema.parse(health);
}

async function getAppRow(db: AppDatabase, appId: string): Promise<typeof apps.$inferSelect> {
  const row = await db.select().from(apps).where(eq(apps.id, appId)).get();
  if (!row) throw notFound();
  return row;
}

async function getPreviewRow(
  db: AppDatabase,
  appId: string,
  profileId: string,
): Promise<typeof previewProfiles.$inferSelect> {
  const row = await db
    .select()
    .from(previewProfiles)
    .where(and(eq(previewProfiles.appId, appId), eq(previewProfiles.id, profileId)))
    .get();
  if (!row) throw notFound();
  return row;
}

async function getCategoryRow(
  db: AppDatabase,
  appId: string,
  categoryId: string,
): Promise<typeof categories.$inferSelect> {
  const row = await db
    .select()
    .from(categories)
    .where(and(eq(categories.appId, appId), eq(categories.id, categoryId)))
    .get();
  if (!row) throw notFound();
  return row;
}

async function getDocumentRow(
  db: AppDatabase,
  appId: string,
  documentId: string,
): Promise<typeof documents.$inferSelect> {
  const row = await db
    .select()
    .from(documents)
    .where(and(eq(documents.appId, appId), eq(documents.id, documentId)))
    .get();
  if (!row) throw notFound();
  return row;
}

async function getResourceRow(
  db: AppDatabase,
  appId: string,
  kind: ResourceKind,
  resourceId: string,
): Promise<ResourceRow> {
  const table = kind === "page" ? pages : templates;
  const row = await db
    .select()
    .from(table)
    .where(and(eq(table.appId, appId), eq(table.id, resourceId)))
    .get();
  if (!row) throw notFound();
  return row;
}

function appRecord(row: typeof apps.$inferSelect): unknown {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    type: row.type,
    status: row.status,
    manifest: {
      mode: row.manifestMode,
      ...(row.manifestUrl ? { url: row.manifestUrl } : {}),
      ...(row.activeManifestRevisionId ? { activeRevisionId: row.activeManifestRevisionId } : {}),
    },
    runtime: row.runtimePublicBaseUrl ? { publicBaseUrl: row.runtimePublicBaseUrl } : {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function previewRecord(row: typeof previewProfiles.$inferSelect): unknown {
  return {
    id: row.id,
    appId: row.appId,
    name: row.name,
    url: row.url,
    allowedOrigins: parseJson(z.array(z.string().url()), row.allowedOriginsJson),
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function categoryRecord(row: typeof categories.$inferSelect): unknown {
  return {
    id: row.id,
    appId: row.appId,
    scope: row.scope,
    key: row.key,
    name: row.name,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function localeRecord(row: typeof locales.$inferSelect): unknown {
  return {
    id: row.id,
    appId: row.appId,
    code: row.code,
    name: row.name,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function openApiDocRecord(row: typeof appOpenApiDocs.$inferSelect): unknown {
  return {
    id: row.id,
    appId: row.appId,
    name: row.name,
    json: JSON.parse(row.json) as unknown,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function resourceRecord(row: ResourceRecordInput): unknown {
  return {
    id: row.id,
    appId: row.appId,
    key: row.key,
    title: row.title,
    description: row.description,
    categoryId: row.categoryId ?? null,
    documentId: row.documentId,
    sourceTemplate: row.sourceTemplateId
      ? {
          templateId: row.sourceTemplateId,
          versionId: row.sourceTemplateVersionId ?? null,
        }
      : null,
    status: row.status,
    currentVersionId: "currentVersionId" in row ? (row.currentVersionId ?? null) : null,
    defaultPromptId: "defaultPromptId" in row ? (row.defaultPromptId ?? null) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function documentRecord(row: typeof documents.$inferSelect): unknown {
  return {
    id: row.id,
    appId: row.appId,
    resourceKind: row.resourceKind,
    resourceId: row.resourceId,
    schemaVersion: row.schemaVersion,
    revision: row.revision,
    draft: parseJson(SceneDocumentSchema, row.draftJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function versionRecord(row: typeof documentVersions.$inferSelect): unknown {
  return {
    id: row.id,
    appId: row.appId,
    documentId: row.documentId,
    versionNumber: row.versionNumber,
    document: parseJson(SceneDocumentSchema, row.documentJson),
    sourceRevision: row.sourceRevision,
    message: row.message,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function releaseRecord(row: typeof releases.$inferSelect): unknown {
  return {
    id: row.id,
    appId: row.appId,
    documentId: row.documentId,
    versionId: row.versionId,
    channel: row.channel,
    status: row.status,
    storageKey: row.storageKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assetRecord(row: typeof assets.$inferSelect): unknown {
  return {
    id: row.id,
    appId: row.appId,
    status: row.status,
    fileName: row.fileName,
    mimeType: row.mimeType,
    size: row.size,
    storageKey: row.storageKey,
    checksum: row.checksum,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function manifestRevisionRecord(row: typeof manifestRevisions.$inferSelect): unknown {
  return {
    id: row.id,
    appId: row.appId,
    protocolVersion: row.protocolVersion,
    appKey: row.appKey,
    manifest: parseJson(AppManifestSchema, row.manifestJson),
    checksum: row.checksum,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseJson<T>(schemaToUse: z.ZodType<T>, value: string): T {
  return schemaToUse.parse(JSON.parse(value) as unknown);
}

function normalizeOrigins(values: string[]): string[] {
  return [...new Set(values.map((value) => new URL(normalizeHttpUrl(value)).origin))];
}

function normalizeHttpUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw validation("URL must use HTTP or HTTPS");
  return url.toString();
}

function assertSafeRemoteUrl(value: string): string {
  const url = normalizeHttpUrl(value);
  const host = new URL(url).hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "::1" ||
    host === "127.0.0.1" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.")
  )
    throw validation("Manifest URL points to a private or loopback address");
  return url;
}

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? 25);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 100 ? parsed : 25;
}
function encodeCursor(value: number): string {
  return Buffer.from(String(value), "utf8").toString("base64url");
}
function decodeCursor(value: string | null): number {
  const parsed = Number(value ? Buffer.from(value, "base64url").toString("utf8") : 0);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}
function parseEtag(value?: string | null): number | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}
function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}
function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  return value;
}
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("hex");
}
function isConstraintError(error: unknown): boolean {
  return error instanceof Error && /unique|constraint|foreign key/i.test(error.message);
}

class ProblemSessionExpired extends ProblemError {
  constructor() {
    super({
      title: "Studio Session expired",
      status: 401,
      detail: "The Studio Session has expired",
    });
  }
}
