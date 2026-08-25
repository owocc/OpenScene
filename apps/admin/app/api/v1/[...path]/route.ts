import type { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { studioSessions, user } from "../../../../server/db/schema";
import {
  assertAppContext,
  assertManagementCsrf,
  authenticate,
  clearUiSessionCookie,
  createUiSessionCookie,
  getUiSessionState,
} from "../../../../server/auth";
import { initializeDatabase, checkDatabaseHealth } from "../../../../server/db/client";
import { getConfig } from "../../../../server/config/env";
import { getAppAssetStorage } from "../../../../server/storage";
import { notFound, problemResponse, ProblemError, validation } from "../../../../server/errors";
import {
  bootstrapStudioSession,
  completeAsset,
  createApp,
  createAppOpenApiDoc,
  createAppPrompt,
  createCategory,
  createLocale,
  createPreviewProfile,
  createRelease,
  createResource,
  createStudioSession,
  createUploadIntent,
  createVersion,
  deleteApp,
  deleteAppOpenApiDoc,
  deleteAppPrompt,
  deleteAsset,
  deleteCategory,
  deleteLocale,
  deletePreviewProfile,
  deleteResource,
  deleteVersion,
  deleteAppStorageConfig,
  getApp,
  getAppOpenApiDoc,
  getAppPrompt,
  getAppStorageConfig,
  getAsset,
  getAssetRawStream,
  getCategory,
  getDocument,
  getDraft,
  getLocale,
  getManifest,
  getManifestRevision,
  getPreviewProfile,
  getRelease,
  getResource,
  getVersion,
  getResourceChatSessions,
  saveResourceChatSessions,
  listAppOpenApiDocs,
  listAppPrompts,
  listApps,
  listAssetFolders,
  listAssets,
  listCategories,
  listLocales,
  listManifestRevisions,
  listPreviewProfiles,
  listReleases,
  listResources,
  listVersions,
  patchAsset,
  pushManifest,
  rotateAppKey,
  runtimePage,
  runtimeRelease,
  storageHealth,
  testAppStorage,
  syncManifest,
  updateApp,
  updateAppOpenApiDoc,
  updateAppPrompt,
  updateCategory,
  updateDraft,
  updateLocale,
  updatePreviewProfile,
  updateResource,
  upsertAppStorageConfig,
  updateStudioDraft,
} from "../../../../server/services";
import {
  chatWithAi,
  getAiConfig,
  getSystemPrompt,
  previewAppSystemPrompt,
  testAiConfig,
  upsertAiConfig,
  upsertSystemPrompt,
} from "../../../../server/ai";
import {
  AiChatRequestSchema,
  AiConfigUpdateSchema,
  AppManifestSchema,
  AppPromptCreateSchema,
  AppPromptPatchSchema,
  PromptPreviewRequestSchema,
  SystemPromptUpdateSchema,
  UiSessionCreateSchema,
  UiSessionSchema,
} from "../../../../server/validation/schemas";

export const runtime = "nodejs";

type Context = { params: Promise<{ path: string[] }> };
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

export async function GET(request: NextRequest, context: Context): Promise<Response> {
  return handle(request, context, "GET");
}
export async function POST(request: NextRequest, context: Context): Promise<Response> {
  return handle(request, context, "POST");
}
export async function PUT(request: NextRequest, context: Context): Promise<Response> {
  return handle(request, context, "PUT");
}
export async function PATCH(request: NextRequest, context: Context): Promise<Response> {
  return handle(request, context, "PATCH");
}
export async function DELETE(request: NextRequest, context: Context): Promise<Response> {
  return handle(request, context, "DELETE");
}
export async function OPTIONS(request: NextRequest, context: Context): Promise<Response> {
  return handle(request, context, "OPTIONS");
}

async function handle(request: NextRequest, context: Context, method: Method): Promise<Response> {
  const { path } = await context.params;
  return withCors(
    await handleRequest(request, { params: Promise.resolve({ path }) }, method),
    request,
    path,
  );
}

async function handleRequest(
  request: NextRequest,
  context: Context,
  method: Method,
): Promise<Response> {
  const { path } = await context.params;
  const pathname = `/api/v1/${path.join("/")}`;
  if (method === "OPTIONS") return new Response(null, { status: 204 });
  try {
    const runtimeDb = await initializeDatabase();
    const db = runtimeDb.db;
    if (path.length === 2 && path[0] === "auth" && path[1] === "session") {
      if (method === "GET") {
        return json(UiSessionSchema.parse(getUiSessionState(request)), 200, {
          "cache-control": "no-store",
        });
      }
      if (method === "POST") {
        const config = getConfig();
        const input = await parseBody(request, UiSessionCreateSchema);
        if (config.auth.mode === "token" && input.token !== config.auth.managementToken)
          throw new ProblemError({
            title: "Authentication required",
            status: 401,
            detail: "The management token is invalid",
          });
        if (config.auth.mode !== "token")
          return json(UiSessionSchema.parse(getUiSessionState(request)), 200, {
            "cache-control": "no-store",
          });
        const cookie = createUiSessionCookie(request);
        return json(
          UiSessionSchema.parse({
            authenticated: true,
            mode: config.auth.mode,
            expiresAt: cookie.expiresAt,
          }),
          200,
          { "cache-control": "no-store", "set-cookie": cookie.value },
        );
      }
      if (method === "DELETE")
        return new Response(null, {
          status: 204,
          headers: { "set-cookie": clearUiSessionCookie(request) },
        });
      throw notFound();
    }
    if (path.length === 2 && path[0] === "auth" && path[1] === "setup-status" && method === "GET") {
      const userCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(user)
        .get();
      const count = userCount?.count ?? 0;
      return json({ initialized: count > 0, hasUsers: count > 0 }, 200, {
        "cache-control": "no-store",
      });
    }
    if (path.length === 1 && path[0] === "health" && method === "GET") {
      const database = await checkDatabaseHealth(runtimeDb);
      const storage = await storageHealth();
      return Response.json({
        status: database.status === "up" ? "ok" : "degraded",
        database,
        storage,
      });
    }
    if (path.length === 2 && path[0] === "storage" && path[1] === "health" && method === "GET")
      return Response.json(await storageHealth());
    if (path[0] === "runtime") return await handleRuntime(request, db, path, method);
    if (path[0] === "studio-sessions" && path[2] === "bootstrap" && method === "GET") {
      const authContext = await authenticate(request, db, "session");
      if (authContext.kind !== "session" || authContext.sessionId !== path[1]) throw notFound();
      return json(await bootstrapStudioSession(db, path[1]), 200, { "cache-control": "no-store" });
    }
    if (path[0] === "studio-sessions" && path[2] === "draft" && method === "PATCH") {
      const authContext = await authenticate(request, db, "session");
      if (authContext.kind !== "session" || authContext.sessionId !== path[1]) throw notFound();
      const result = await updateStudioDraft(db, path[1], await body(request));
      return json(result, 200, {
        etag: `"${(result as { revision: number }).revision}"`,
        "cache-control": "no-store",
      });
    }
    if (path[0] === "studio-sessions" && path[2] === "openapi-docs") {
      const authContext = await authenticate(request, db, "session");
      if (authContext.kind !== "session" || authContext.sessionId !== path[1]) throw notFound();
      const appId = authContext.appId!;
      if (path.length === 3 && method === "GET")
        return json(
          (await listAppOpenApiDocs(db, appId)).map((doc) => {
            const { json: _json, ...rest } = doc as Record<string, unknown>;
            return rest;
          }),
          200,
          { "cache-control": "no-store" },
        );
      if (path.length === 4 && method === "GET")
        return json(await getAppOpenApiDoc(db, appId, path[3]), 200, {
          "cache-control": "no-store",
        });
      throw notFound();
    }
    if (path[0] === "studio-sessions" && path[2] === "assets") {
      const authContext = await authenticate(request, db, "session");
      if (authContext.kind !== "session" || authContext.sessionId !== path[1]) throw notFound();
      const appId = authContext.appId!;
      const rewrittenPath = ["apps", appId, ...path.slice(2)];
      return await assetRoutes(request, db, method, rewrittenPath);
    }
    if (path[0] === "studio-sessions" && path[2] === "prompts" && method === "GET") {
      const authContext = await authenticate(request, db, "session");
      if (authContext.kind !== "session" || authContext.sessionId !== path[1]) throw notFound();
      const appId = authContext.appId!;
      return json(await listAppPrompts(db, appId), 200, { "cache-control": "no-store" });
    }
    if (
      path[0] === "studio-sessions" &&
      path[2] === "prompt-preview" &&
      (method === "POST" || method === "GET")
    ) {
      const authContext = await authenticate(request, db, "session");
      if (authContext.kind !== "session" || authContext.sessionId !== path[1]) throw notFound();
      const appId = authContext.appId!;
      const input =
        method === "POST" ? await parseBody(request, PromptPreviewRequestSchema.optional()) : {};
      return json(await previewAppSystemPrompt(db, appId, input ?? {}));
    }
    if (path[0] === "studio-sessions" && path[2] === "chat" && method === "POST") {
      const authContext = await authenticate(request, db, "session");
      if (authContext.kind !== "session" || authContext.sessionId !== path[1]) throw notFound();
      const input = await parseBody(request, AiChatRequestSchema);
      const appId = authContext.appId ?? input.appId;
      return await chatWithAi(db, { ...input, appId });
    }
    if (path[0] === "studio-sessions" && path[2] === "chat-sessions") {
      const authContext = await authenticate(request, db, "session");
      if (authContext.kind !== "session" || authContext.sessionId !== path[1]) throw notFound();
      const session = await db
        .select()
        .from(studioSessions)
        .where(eq(studioSessions.id, path[1]))
        .get();
      if (!session) throw notFound();
      if (method === "GET") {
        return json(
          await getResourceChatSessions(
            db,
            session.appId,
            session.resourceKind,
            session.resourceId,
          ),
          200,
          { "cache-control": "no-store" },
        );
      }
      if (method === "PUT") {
        const body = await parseBody(request, z.array(z.record(z.string(), z.unknown())));
        return json(
          await saveResourceChatSessions(
            db,
            session.appId,
            session.resourceKind,
            session.resourceId,
            body,
          ),
          200,
          { "cache-control": "no-store" },
        );
      }
      throw notFound();
    }

    if (path[0] === "ai") return await aiRoutes(request, db, method, path);

    const appId = path[0] === "apps" ? path[1] : undefined;
    const isPublicRawAsset =
      path[0] === "apps" && path[2] === "assets" && path[4] === "raw" && method === "GET";
    const isLocalUpload =
      path[0] === "apps" && path[2] === "assets" && path[3] === "upload" && method === "PUT";
    const requirement =
      isPublicRawAsset || isLocalUpload
        ? "public"
        : path[0] === "apps" && path[2] === "manifest" && path[3] === "push"
          ? "app-key"
          : "management";
    await authenticate(request, db, requirement, appId);
    if (requirement === "management") assertManagementCsrf(request, method);
    if (path[0] !== "apps") throw notFound();
    if (path.length === 1 && method === "GET")
      return json(await listApps(db, request.nextUrl.searchParams));
    if (path.length === 1 && method === "POST")
      return json(await createApp(db, await body(request)), 201);
    if (path.length === 2) return await resourceCrud(request, db, method, "app", path[1]);

    if (path[2] === "preview-profiles") return await previewRoutes(request, db, method, path);
    if (path[2] === "app-keys") return await appKeyRoutes(db, method, path);
    if (path[2] === "prompts" || path[2] === "prompt")
      return await promptRoutes(request, db, method, path);
    if (path[2] === "manifest") return await manifestRoutes(request, db, method, path);
    if (path[2] === "openapi-docs") return await openApiDocRoutes(request, db, method, path);
    if (path[2] === "pages" || path[2] === "templates")
      return await resourceRoutes(request, db, method, path);
    if (path[2] === "documents") return await documentRoutes(request, db, method, path);
    if (path[2] === "categories") return await categoryRoutes(request, db, method, path);
    if (path[2] === "locales") return await localeRoutes(request, db, method, path);
    if (path[2] === "storage") return await appStorageRoutes(request, db, method, path);
    if (path[2] === "assets") return await assetRoutes(request, db, method, path);
    if (path[2] === "studio-sessions") return await sessionRoutes(request, db, method, path);
    if (path[2] === "releases") {
      if (method !== "GET" || path.length !== 4) throw notFound();
      return json(await getRelease(db, path[1], path[3]));
    }
    throw notFound();
  } catch (error) {
    return problemResponse(error, pathname);
  }
}

async function resourceCrud(
  request: NextRequest,
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  method: Method,
  kind: "app",
  id: string,
): Promise<Response> {
  if (kind !== "app") throw notFound();
  if (method === "GET") return json(await getApp(db, id));
  if (method === "PATCH") return json(await updateApp(db, id, await body(request)));
  if (method === "DELETE") {
    await deleteApp(db, id);
    return noContent();
  }
  throw notFound();
}
async function appKeyRoutes(
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  method: Method,
  path: string[],
): Promise<Response> {
  if (path.length !== 4 || path[3] !== "rotate" || method !== "POST") throw notFound();
  return json(await rotateAppKey(db, path[1]));
}
async function promptRoutes(
  request: NextRequest,
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  method: Method,
  path: string[],
): Promise<Response> {
  const appId = path[1];
  if (path.length === 3 && method === "GET") {
    return json(await listAppPrompts(db, appId));
  }
  if (path.length === 3 && method === "POST") {
    const input = await parseBody(request, AppPromptCreateSchema);
    return json(await createAppPrompt(db, appId, input), 201);
  }
  if (path.length === 4 && method === "GET") {
    return json(await getAppPrompt(db, appId, path[3]));
  }
  if (path.length === 4 && method === "PATCH") {
    const input = await parseBody(request, AppPromptPatchSchema);
    return json(await updateAppPrompt(db, appId, path[3], input));
  }
  if (path.length === 4 && method === "DELETE") {
    await deleteAppPrompt(db, appId, path[3]);
    return noContent();
  }
  throw notFound();
}

async function aiRoutes(
  request: NextRequest,
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  method: Method,
  path: string[],
): Promise<Response> {
  // Global, management-protected configuration endpoints.
  if (path[1] === "config") {
    if (method === "GET") {
      await authenticate(request, db, "management");
      return json(await getAiConfig(db));
    }
    if (method === "PATCH") {
      await authenticate(request, db, "management");
      assertManagementCsrf(request, method);
      const input = await parseBody(request, AiConfigUpdateSchema);
      return json(await upsertAiConfig(db, input));
    }
    if (path[2] === "test" && method === "POST") {
      await authenticate(request, db, "management");
      assertManagementCsrf(request, method);
      const input = await parseBody(request, AiConfigUpdateSchema.partial());
      return json(await testAiConfig(db, input));
    }
    throw notFound();
  }
  if (path[1] === "system-prompt") {
    if (method === "GET") {
      await authenticate(request, db, "management");
      return json(await getSystemPrompt(db));
    }
    if (method === "PATCH") {
      await authenticate(request, db, "management");
      assertManagementCsrf(request, method);
      const input = await parseBody(request, SystemPromptUpdateSchema);
      return json(await upsertSystemPrompt(db, input));
    }
    throw notFound();
  }
  // Client consumption endpoint: every call must present a valid App Key or Studio Session and its app id.
  if (path[1] === "chat" && method === "POST") {
    const authContext = await authenticate(request, db, "client");
    const input = await parseBody(request, AiChatRequestSchema);
    const appId = authContext.appId ?? input.appId;
    assertAppContext(authContext, appId);
    return await chatWithAi(db, { ...input, appId });
  }
  if (path[1] === "prompt-preview" && method === "POST") {
    const authContext = await authenticate(request, db, "client");
    const input = await parseBody(request, PromptPreviewRequestSchema);
    const appId = authContext.appId ?? input.appId;
    if (!appId)
      throw validation("appId is required", [{ path: "appId", message: "appId is required" }]);
    assertAppContext(authContext, appId);
    return json(await previewAppSystemPrompt(db, appId, input));
  }
  throw notFound();
}

async function previewRoutes(
  request: NextRequest,
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  method: Method,
  path: string[],
): Promise<Response> {
  const appId = path[1];
  if (path.length === 3 && method === "GET") return json(await listPreviewProfiles(db, appId));
  if (path.length === 3 && method === "POST")
    return json(await createPreviewProfile(db, appId, await body(request)), 201);
  const profileId = path[3];
  if (!profileId) throw notFound();
  if (method === "GET") return json(await getPreviewProfile(db, appId, profileId));
  if (method === "PATCH")
    return json(await updatePreviewProfile(db, appId, profileId, await body(request)));
  if (method === "DELETE") {
    await deletePreviewProfile(db, appId, profileId);
    return noContent();
  }
  throw notFound();
}

async function manifestRoutes(
  request: NextRequest,
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  method: Method,
  path: string[],
): Promise<Response> {
  const appId = path[1];
  if (path.length === 3 && method === "GET") return json(await getManifest(db, appId));
  if (path[3] === "revisions" && path.length === 4 && method === "GET")
    return json(await listManifestRevisions(db, appId));
  if (path[3] === "revisions" && path.length === 5 && method === "GET")
    return json(await getManifestRevision(db, appId, path[4]));
  if (path[3] === "sync" && method === "POST") return json(await syncManifest(db, appId));
  if (path[3] === "push" && method === "POST")
    return json(await pushManifest(db, appId, await parseBody(request, AppManifestSchema), "push"));
  throw notFound();
}

async function resourceRoutes(
  request: NextRequest,
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  method: Method,
  path: string[],
): Promise<Response> {
  const appId = path[1];
  const kind = path[2] === "pages" ? ("page" as const) : ("template" as const);
  if (path.length === 3 && method === "GET")
    return json(await listResources(db, appId, kind, request.nextUrl.searchParams));
  if (path.length === 3 && method === "POST")
    return json(await createResource(db, appId, kind, await body(request)), 201);
  const resourceId = path[3];
  if (!resourceId) throw notFound();
  if (method === "GET") return json(await getResource(db, appId, kind, resourceId));
  if (method === "PATCH")
    return json(await updateResource(db, appId, kind, resourceId, await body(request)));
  if (method === "DELETE") {
    await deleteResource(db, appId, kind, resourceId);
    return noContent();
  }
  throw notFound();
}

async function documentRoutes(
  request: NextRequest,
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  method: Method,
  path: string[],
): Promise<Response> {
  const appId = path[1];
  const documentId = path[3];
  if (!documentId) throw notFound();
  if (path.length === 4 && method === "GET") return json(await getDocument(db, appId, documentId));
  if (path[4] === "draft" && path.length === 5 && method === "GET") {
    const result = await getDraft(db, appId, documentId);
    return json(result, 200, {
      etag: `"${(result as { revision: number }).revision}"`,
      "cache-control": "no-store",
    });
  }
  if (path[4] === "draft" && path.length === 5 && method === "PATCH") {
    const result = await updateDraft(
      db,
      appId,
      documentId,
      await body(request),
      request.headers.get("if-match"),
    );
    return json(result, 200, {
      etag: `"${(result as { revision: number }).revision}"`,
      "cache-control": "no-store",
    });
  }
  if (path[4] === "versions" && path.length === 5 && method === "GET")
    return json(await listVersions(db, appId, documentId));
  if (path[4] === "versions" && path.length === 5 && method === "POST")
    return json(await createVersion(db, appId, documentId, await body(request)), 201);
  if (path[4] === "versions" && path.length === 6 && method === "GET")
    return json(await getVersion(db, appId, documentId, path[5]));
  if (path[4] === "versions" && path.length === 6 && method === "DELETE") {
    await deleteVersion(db, appId, documentId, path[5]);
    return noContent();
  }
  if (path[4] === "releases" && path.length === 5 && method === "GET")
    return json(await listReleases(db, appId, documentId));
  if (path[4] === "releases" && path.length === 5 && method === "POST")
    return json(await createRelease(db, appId, documentId, await body(request)), 201);
  throw notFound();
}

async function categoryRoutes(
  request: NextRequest,
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  method: Method,
  path: string[],
): Promise<Response> {
  const appId = path[1];
  if (path.length === 3 && method === "GET") return json(await listCategories(db, appId));
  if (path.length === 3 && method === "POST")
    return json(await createCategory(db, appId, await body(request)), 201);
  const id = path[3];
  if (!id) throw notFound();
  if (method === "GET") return json(await getCategory(db, appId, id));
  if (method === "PATCH") return json(await updateCategory(db, appId, id, await body(request)));
  if (method === "DELETE") {
    await deleteCategory(db, appId, id);
    return noContent();
  }
  throw notFound();
}

async function localeRoutes(
  request: NextRequest,
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  method: Method,
  path: string[],
): Promise<Response> {
  const appId = path[1];
  if (path.length === 3 && method === "GET") return json(await listLocales(db, appId));
  if (path.length === 3 && method === "POST")
    return json(await createLocale(db, appId, await body(request)), 201);
  const id = path[3];
  if (!id) throw notFound();
  if (method === "GET") return json(await getLocale(db, appId, id));
  if (method === "PATCH") return json(await updateLocale(db, appId, id, await body(request)));
  if (method === "DELETE") {
    await deleteLocale(db, appId, id);
    return noContent();
  }
  throw notFound();
}
async function openApiDocRoutes(
  request: NextRequest,
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  method: Method,
  path: string[],
): Promise<Response> {
  const appId = path[1];
  if (path.length === 3 && method === "GET") return json(await listAppOpenApiDocs(db, appId));
  if (path.length === 3 && method === "POST")
    return json(await createAppOpenApiDoc(db, appId, await body(request)), 201);
  const openApiDocId = path[3];
  if (!openApiDocId) throw notFound();
  if (method === "GET") return json(await getAppOpenApiDoc(db, appId, openApiDocId));
  if (method === "PATCH")
    return json(await updateAppOpenApiDoc(db, appId, openApiDocId, await body(request)));
  if (method === "DELETE") {
    await deleteAppOpenApiDoc(db, appId, openApiDocId);
    return noContent();
  }
  throw notFound();
}

async function assetRoutes(
  request: NextRequest,
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  method: Method,
  path: string[],
): Promise<Response> {
  const appId = path[1];
  if (path.length === 3 && method === "GET") {
    const url = new URL(request.url);
    const folder = url.searchParams.get("folder") ?? undefined;
    const tag = url.searchParams.get("tag") ?? undefined;
    const type = url.searchParams.get("type") ?? undefined;
    const q = url.searchParams.get("q") ?? undefined;
    const status = url.searchParams.get("status") as "pending" | "ready" | "failed" | null;
    return json(
      await listAssets(db, appId, {
        folder,
        tag,
        type,
        q,
        status: status ?? undefined,
      }),
    );
  }
  if (path[3] === "folders" && method === "GET") {
    return json(await listAssetFolders(db, appId));
  }
  if (path[3] === "upload-intents" && method === "POST")
    return json(await createUploadIntent(db, appId, await body(request)), 201);
  if (path[3] === "upload" && method === "PUT") {
    const key = request.nextUrl.searchParams.get("key");
    if (!key)
      throw validation("Missing storage key parameter", [
        { path: "key", message: "key query parameter is required" },
      ]);
    const storage = await getAppAssetStorage(db, appId);
    const mimeType = request.headers.get("content-type") || "application/octet-stream";
    const bodyBuffer = new Uint8Array(await request.arrayBuffer());
    await storage.put(key, bodyBuffer, mimeType);
    return new Response(null, { status: 200 });
  }
  const assetId = path[3];
  if (!assetId) throw notFound();
  if (path.length === 4 && method === "GET") return json(await getAsset(db, appId, assetId));
  if (path.length === 4 && method === "PATCH")
    return json(await patchAsset(db, appId, assetId, await body(request)));
  if (path[4] === "complete" && method === "POST")
    return json(await completeAsset(db, appId, assetId, await body(request)));
  if (path[4] === "raw" && method === "GET") {
    const raw = await getAssetRawStream(db, appId, assetId);
    return new Response(raw.body as BodyInit, {
      status: 200,
      headers: {
        "content-type": raw.mimeType,
        "content-length": String(raw.size),
        "content-disposition": `inline; filename="${encodeURIComponent(raw.fileName)}"`,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }
  if (path.length === 4 && method === "DELETE") {
    await deleteAsset(db, appId, assetId);
    return noContent();
  }
  throw notFound();
}
async function appStorageRoutes(
  request: NextRequest,
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  method: Method,
  path: string[],
): Promise<Response> {
  const appId = path[1];
  if (path.length === 3 && method === "GET") {
    return json(await getAppStorageConfig(db, appId));
  }
  if (path.length === 3 && (method === "PUT" || method === "POST")) {
    return json(await upsertAppStorageConfig(db, appId, await body(request)));
  }
  if (path.length === 3 && method === "DELETE") {
    await deleteAppStorageConfig(db, appId);
    return noContent();
  }
  if (path.length === 4 && path[3] === "health" && method === "GET") {
    return json(await testAppStorage(db, appId));
  }
  if (path.length === 4 && path[3] === "test" && method === "POST") {
    return json(await testAppStorage(db, appId, await body(request)));
  }
  throw notFound();
}

async function sessionRoutes(
  request: NextRequest,
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  method: Method,
  path: string[],
): Promise<Response> {
  if (path.length === 3 && method === "POST")
    return json(await createStudioSession(db, path[1], await body(request)), 201, {
      "cache-control": "no-store",
    });
  throw notFound();
}

async function handleRuntime(
  request: NextRequest,
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  path: string[],
  method: Method,
): Promise<Response> {
  if (method !== "GET") throw notFound();
  const appKey = path[2];
  if (path[1] !== "apps" || !appKey) throw notFound();
  const context = await authenticate(request, db, "runtime");
  if (path[3] === "pages" && path.length === 5) {
    const result = await runtimePage(db, appKey, path[4]);
    if (context.appId && context.appId !== (result.payload as { app: { id: string } }).app.id)
      throw notFound();
    return json(result.payload, 200, {
      etag: result.etag,
      "cache-control": "public, max-age=60, s-maxage=300, immutable",
    });
  }
  if (path[3] === "releases" && path.length === 5) {
    const result = await runtimeRelease(db, appKey, path[4]);
    if (context.appId && context.appId !== (result.payload as { app: { id: string } }).app.id)
      throw notFound();
    return json(result.payload, 200, {
      etag: result.etag,
      "cache-control": "public, max-age=60, s-maxage=300, immutable",
    });
  }
  throw notFound();
}

async function body(request: NextRequest): Promise<unknown> {
  return parseBody(request, z.object({}).catchall(z.unknown()));
}

async function parseBody<T>(request: NextRequest, schema: z.ZodType<T>): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json"))
    throw new ProblemError({
      title: "Unsupported media type",
      status: 415,
      detail: "Expected application/json",
    });
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ProblemError({
      title: "Bad request",
      status: 400,
      detail: "Request body is not valid JSON",
    });
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw validation(
      "The request body is invalid",
      parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  return parsed.data;
}

function withCors(response: Response, request: NextRequest, path: string[]): Response {
  const headers = new Headers(response.headers);
  const config = getConfig();
  const origin = request.headers.get("origin");
  if (path[0] === "runtime" && config.auth.runtimePublic) {
    headers.set("access-control-allow-origin", "*");
    headers.set("access-control-allow-methods", "GET, OPTIONS");
    headers.set("access-control-allow-headers", "content-type, authorization");
  } else if (path[0] === "studio-sessions") {
    headers.set("vary", appendVary(headers.get("vary"), "Origin"));
    const studioOrigin = new URL(config.studio.publicBaseUrl).origin;
    if (origin === studioOrigin) headers.set("access-control-allow-origin", studioOrigin);
    headers.set("access-control-allow-methods", "GET, PATCH, OPTIONS");
    headers.set(
      "access-control-allow-headers",
      "content-type, x-openscene-session-token, authorization",
    );
  } else if (path[0] === "ai") {
    headers.set("vary", appendVary(headers.get("vary"), "Origin"));
    if (path[1] === "chat") {
      // Public consumption endpoint: any origin may call it, but the App Key is required.
      headers.set("access-control-allow-origin", "*");
      headers.set("access-control-allow-methods", "POST, OPTIONS");
      headers.set("access-control-allow-headers", "content-type, x-openscene-app-key");
    } else {
      const aiOrigin = request.headers.get("origin");
      if (
        aiOrigin &&
        (aiOrigin === request.nextUrl.origin || config.auth.managementOrigins.includes(aiOrigin))
      )
        headers.set("access-control-allow-origin", aiOrigin);
      headers.set("access-control-allow-methods", "GET, PUT, POST, OPTIONS");
      headers.set("access-control-allow-headers", "content-type");
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function appendVary(current: string | null, value: string): string {
  const values = new Set(
    (current ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  values.add(value);
  return [...values].join(", ");
}
function json(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(value, { status, headers });
}
function noContent(): Response {
  return new Response(null, { status: 204 });
}
