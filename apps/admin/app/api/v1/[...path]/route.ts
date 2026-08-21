import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  assertManagementCsrf,
  authenticate,
  clearUiSessionCookie,
  createUiSessionCookie,
  getUiSessionState,
} from "../../../../server/auth";
import { initializeDatabase, checkDatabaseHealth } from "../../../../server/db/client";
import { getConfig } from "../../../../server/config/env";
import { notFound, problemResponse, ProblemError, validation } from "../../../../server/errors";
import { getStorage } from "../../../../server/storage";
import { apps } from "../../../../server/db/schema";
import {
  bootstrapStudioSession,
  completeAsset,
  createApp,
  createCategory,
  createLocale,
  createPreviewProfile,
  createRelease,
  createResource,
  createStudioSession,
  createUploadIntent,
  createVersion,
  deleteApp,
  deleteAsset,
  deleteCategory,
  deleteLocale,
  deletePreviewProfile,
  deleteResource,
  getApp,
  getAsset,
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
  listApps,
  listAssets,
  listCategories,
  listLocales,
  listManifestRevisions,
  listPreviewProfiles,
  listReleases,
  listResources,
  listVersions,
  pushManifest,
  runtimePage,
  runtimeRelease,
  storageHealth,
  syncManifest,
  updateApp,
  updateCategory,
  updateDraft,
  updateLocale,
  updatePreviewProfile,
  updateResource,
} from "../../../../server/services";
import {
  ManifestSchema,
  UiSessionCreateSchema,
  UiSessionSchema,
} from "../../../../server/validation/schemas";

export const runtime = "nodejs";

type Context = { params: Promise<{ path: string[] }> };
type Method = "GET" | "POST" | "PATCH" | "DELETE";

export async function GET(request: NextRequest, context: Context): Promise<Response> {
  return handle(request, context, "GET");
}
export async function POST(request: NextRequest, context: Context): Promise<Response> {
  return handle(request, context, "POST");
}
export async function PATCH(request: NextRequest, context: Context): Promise<Response> {
  return handle(request, context, "PATCH");
}
export async function DELETE(request: NextRequest, context: Context): Promise<Response> {
  return handle(request, context, "DELETE");
}

async function handle(request: NextRequest, context: Context, method: Method): Promise<Response> {
  const { path } = await context.params;
  const pathname = `/api/v1/${path.join("/")}`;
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
    if (path.length === 1 && path[0] === "health" && method === "GET") {
      const database = await checkDatabaseHealth(runtimeDb);
      const storage = await getStorage().health();
      return Response.json({
        status: database.status === "up" && storage.status !== "down" ? "ok" : "degraded",
        database,
        storage,
      });
    }
    if (path.length === 2 && path[0] === "storage" && path[1] === "health" && method === "GET")
      return Response.json(await storageHealth());

    if (path[0] === "runtime") return await handleRuntime(request, db, path, method);
    if (path[0] === "studio-sessions" && path[2] === "bootstrap" && method === "GET") {
      await authenticate(request, db, "session");
      return json(await bootstrapStudioSession(db, path[1]), 200, { "cache-control": "no-store" });
    }

    const appId = path[0] === "apps" ? path[1] : undefined;
    const requirement =
      path[0] === "apps" && path[2] === "manifest" && path[3] === "push" ? "app-key" : "management";
    await authenticate(request, db, requirement, appId);
    if (requirement === "management") assertManagementCsrf(request, method);

    if (path[0] !== "apps") throw notFound();
    if (path.length === 1 && method === "GET")
      return json(await listApps(db, request.nextUrl.searchParams));
    if (path.length === 1 && method === "POST")
      return json(await createApp(db, await body(request)), 201);
    if (path.length === 2) return await resourceCrud(request, db, method, "app", path[1]);

    if (path[2] === "preview-profiles") return await previewRoutes(request, db, method, path);
    if (path[2] === "manifest") return await manifestRoutes(request, db, method, path);
    if (path[2] === "pages" || path[2] === "templates")
      return await resourceRoutes(request, db, method, path);
    if (path[2] === "documents") return await documentRoutes(request, db, method, path);
    if (path[2] === "categories") return await categoryRoutes(request, db, method, path);
    if (path[2] === "locales") return await localeRoutes(request, db, method, path);
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
    return json(await pushManifest(db, appId, await parseBody(request, ManifestSchema), "push"));
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

async function assetRoutes(
  request: NextRequest,
  db: Awaited<ReturnType<typeof initializeDatabase>>["db"],
  method: Method,
  path: string[],
): Promise<Response> {
  const appId = path[1];
  if (path.length === 3 && method === "GET") return json(await listAssets(db, appId));
  if (path[3] === "upload-intents" && method === "POST")
    return json(await createUploadIntent(db, appId, await body(request)), 201);
  const assetId = path[3];
  if (!assetId) throw notFound();
  if (path.length === 4 && method === "GET") return json(await getAsset(db, appId, assetId));
  if (path[4] === "complete" && method === "POST")
    return json(await completeAsset(db, appId, assetId, await body(request)));
  if (path.length === 4 && method === "DELETE") {
    await deleteAsset(db, appId, assetId);
    return noContent();
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
    if (context.appId) {
      const app = await db.select({ id: apps.id }).from(apps).where(eq(apps.key, appKey)).get();
      if (app?.id !== context.appId) throw notFound();
    }
    return json(result.payload, 200, {
      etag: result.etag,
      "cache-control": "public, max-age=60, s-maxage=300, immutable",
    });
  }
  if (path[3] === "releases" && path.length === 5) {
    if (context.appId) {
      const app = await db.select({ id: apps.id }).from(apps).where(eq(apps.key, appKey)).get();
      if (app?.id !== context.appId) throw notFound();
    }
    const result = await runtimeRelease(db, appKey, path[4]);
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

function json(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(value, { status, headers });
}
function noContent(): Response {
  return new Response(null, { status: 204 });
}
