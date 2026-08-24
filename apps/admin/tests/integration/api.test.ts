import { and, eq, isNull } from "drizzle-orm";
import { APP_TYPE_WEB } from "@openscene/constants";
import { createEmptySceneDocument } from "@openscene/protocol";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { DELETE, GET, PATCH, POST } from "../../app/api/v1/[...path]/route";
import { initializeDatabase, resetDatabaseForTests } from "../../server/db/client";
import { appKeys } from "../../server/db/schema";
import { resetConfigForTests } from "../../server/config/env";
import { resetStorageForTests } from "../../server/storage";
import { createOpenApiDocument } from "../../server/openapi/document";
import {
  DEFAULT_APP_SYSTEM_PROMPT,
  DEFAULT_GLOBAL_SYSTEM_PROMPT,
} from "../../server/validation/schemas";

type PathContext = { params: Promise<{ path: string[] }> };

let tempDir: string;
let appA: { id: string; appKey: string; runtimeKey: string };
let appB: { id: string; appKey: string; runtimeKey: string };
let pageA: {
  id: string;
  documentId: string;
  sourceTemplate: { templateId: string; versionId: string } | null;
};
const emptyDocument = createEmptySceneDocument();
let profileA: { id: string };

beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "openscene-api-"));
  process.env.OPENSCENE_DATABASE_URL = `file:${path.join(tempDir, "test.db")}`;
  process.env.OPENSCENE_AUTH_MODE = "disabled";
  process.env.OPENSCENE_STORAGE_DRIVER = "memory";
  process.env.OPENSCENE_STUDIO_PUBLIC_BASE_URL = "http://localhost:5173";
  resetConfigForTests();
  resetStorageForTests();
  await resetDatabaseForTests();

  const responseA = await call("POST", ["apps"], {
    key: "app-a",
    name: "App A",
    type: APP_TYPE_WEB,
  });
  expect(responseA.status).toBe(201);
  const bodyA = await responseA.json();
  expect(bodyA.type).toBe(APP_TYPE_WEB);
  appA = {
    id: bodyA.id,
    appKey: bodyA.credentials.appKey,
    runtimeKey: bodyA.credentials.runtimeKey,
  };
  const responseB = await call("POST", ["apps"], {
    key: "app-b",
    name: "App B",
    type: APP_TYPE_WEB,
  });
  expect(responseB.status).toBe(201);
  const bodyB = await responseB.json();
  appB = {
    id: bodyB.id,
    appKey: bodyB.credentials.appKey,
    runtimeKey: bodyB.credentials.runtimeKey,
  };
});

afterAll(async () => {
  await resetDatabaseForTests();
  resetStorageForTests();
  resetConfigForTests();
});

describe("Admin API HTTP flow", () => {
  test("creates an isolated page and preview profile", async () => {
    const profile = await call("POST", ["apps", appA.id, "preview-profiles"], {
      name: "local",
      url: "http://localhost:4000/preview",
      allowedOrigins: ["http://localhost:4000", "http://localhost:4000"],
      isDefault: true,
    });
    expect(profile.status).toBe(201);
    const profileBody = await profile.json();
    profileA = { id: profileBody.id };
    expect(profileBody.allowedOrigins).toEqual(["http://localhost:4000"]);

    const page = await call("POST", ["apps", appA.id, "pages"], { key: "home", title: "Home" });
    expect(page.status).toBe(201);
    pageA = await page.json();
    expect(pageA.sourceTemplate).toBeNull();
    const foreign = await call("GET", ["apps", appB.id, "pages", pageA.id]);
    expect(foreign.status).toBe(404);
  });

  test("persists and exposes the source Template association on Pages", async () => {
    const template = await call("POST", ["apps", appA.id, "templates"], {
      key: "section",
      title: "Section",
    });
    expect(template.status).toBe(201);
    const templateBody = await template.json();
    const version = await call(
      "POST",
      ["apps", appA.id, "documents", templateBody.documentId, "versions"],
      { message: "Seed" },
    );
    expect(version.status).toBe(201);
    const versionBody = await version.json();
    const page = await call("POST", ["apps", appA.id, "pages"], {
      key: "from-template",
      title: "From Template",
      sourceTemplate: { templateId: templateBody.id, versionId: versionBody.id },
    });
    expect(page.status).toBe(201);
    const pageBody = await page.json();
    expect(pageBody.sourceTemplate).toEqual({
      templateId: templateBody.id,
      versionId: versionBody.id,
    });
    const fetched = await call("GET", ["apps", appA.id, "pages", pageBody.id]);
    expect(fetched.status).toBe(200);
    expect((await fetched.json()).sourceTemplate).toEqual({
      templateId: templateBody.id,
      versionId: versionBody.id,
    });
  });

  test("creates a short-lived Studio Session and Bootstrap", async () => {
    const session = await call("POST", ["apps", appA.id, "studio-sessions"], {
      resourceKind: "page",
      resourceId: pageA.id,
      previewProfileId: profileA.id,
      returnUrl: "http://localhost:3000/pages",
    });
    expect(session.status).toBe(201);
    const sessionBody = await session.json();
    expect(sessionBody.launchUrl).toMatch(
      new RegExp(
        `^http://localhost:5173\\?server-url=http%3A%2F%2Flocalhost%3A3000&sessionId=${sessionBody.id}#token=`,
      ),
    );
    const bootstrap = await call(
      "GET",
      ["studio-sessions", sessionBody.id, "bootstrap"],
      undefined,
      {
        "x-openscene-session-token": sessionBody.token,
      },
    );
    expect(bootstrap.status).toBe(200);
    const bootstrapBody = await bootstrap.json();
    expect(bootstrapBody.resource.documentId).toBe(pageA.documentId);
    expect(bootstrapBody.app.type).toBe(APP_TYPE_WEB);
    expect(bootstrapBody.preview.allowedOrigin).toBe("http://localhost:4000");
    expect(JSON.stringify(bootstrapBody)).not.toContain("encryptedHeaders");
  });

  test("protects Draft updates with ETag/revision", async () => {
    const draft = await call("GET", ["apps", appA.id, "documents", pageA.documentId, "draft"]);
    expect(draft.status).toBe(200);
    expect(draft.headers.get("etag")).toBe('"0"');
    const updated = await call("PATCH", ["apps", appA.id, "documents", pageA.documentId, "draft"], {
      baseRevision: 0,
      document: { ...emptyDocument, spec: { ...emptyDocument.spec, title: "Updated" } },
    });
    expect(updated.status).toBe(200);
    expect((await updated.json()).revision).toBe(1);
    const conflict = await call(
      "PATCH",
      ["apps", appA.id, "documents", pageA.documentId, "draft"],
      { baseRevision: 0, document: emptyDocument },
    );
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).errors[0].path).toBe("currentRevision");
  });

  test("creates immutable Version and Runtime Release", async () => {
    const version = await call(
      "POST",
      ["apps", appA.id, "documents", pageA.documentId, "versions"],
      { message: "Initial" },
    );
    expect(version.status).toBe(201);
    const versionBody = await version.json();
    const page = await call("PATCH", ["apps", appA.id, "pages", pageA.id], { status: "published" });
    expect(page.status).toBe(200);
    const release = await call(
      "POST",
      ["apps", appA.id, "documents", pageA.documentId, "releases"],
      { versionId: versionBody.id },
    );
    expect(release.status).toBe(201);
    const runtime = await call("GET", ["runtime", "apps", "app-a", "pages", "home"], undefined, {
      "x-openscene-runtime-key": appA.runtimeKey,
    });
    const runtimeBody = await runtime.json();
    expect(runtimeBody.app?.type ?? runtimeBody.type).toBe(APP_TYPE_WEB);
    expect(runtimeBody.document.spec.title).toBe("Updated");
    const crossApp = await call("GET", ["runtime", "apps", "app-a", "pages", "home"], undefined, {
      "x-openscene-runtime-key": appB.runtimeKey,
    });
    expect(crossApp.status).toBe(404);
  });

  test("App Key cannot push a Manifest into another App", async () => {
    const response = await call(
      "POST",
      ["apps", appB.id, "manifest", "push"],
      { protocolVersion: "1.0", app: { key: "app-b", type: APP_TYPE_WEB }, components: {} },
      { "x-openscene-app-key": appA.appKey },
    );
    expect(response.status).toBe(404);
  });
  test("atomically rotates App Key while preserving Runtime Key authentication", async () => {
    const manifest = {
      protocolVersion: "1.0",
      app: { key: "app-a", type: APP_TYPE_WEB },
      components: {},
    };
    const initialPush = await call("POST", ["apps", appA.id, "manifest", "push"], manifest, {
      "x-openscene-app-key": appA.appKey,
    });
    expect(initialPush.status).toBe(200);

    const runtimeBefore = await call(
      "GET",
      ["runtime", "apps", "app-a", "pages", "home"],
      undefined,
      {
        "x-openscene-runtime-key": appA.runtimeKey,
      },
    );
    expect(runtimeBefore.status).toBe(200);

    const oldAppKey = appA.appKey;
    const rotated = await call("POST", ["apps", appA.id, "app-keys", "rotate"]);
    expect(rotated.status).toBe(200);
    const rotatedBody = await rotated.json();
    expect(Object.keys(rotatedBody)).toEqual(["appKey"]);
    expect(rotatedBody.appKey).not.toBe(oldAppKey);
    appA.appKey = rotatedBody.appKey;

    const oldPush = await call("POST", ["apps", appA.id, "manifest", "push"], manifest, {
      "x-openscene-app-key": oldAppKey,
    });
    expect(oldPush.status).toBe(404);
    const newPush = await call("POST", ["apps", appA.id, "manifest", "push"], manifest, {
      "x-openscene-app-key": appA.appKey,
    });
    expect(newPush.status).toBe(200);

    const runtimeAfter = await call(
      "GET",
      ["runtime", "apps", "app-a", "pages", "home"],
      undefined,
      {
        "x-openscene-runtime-key": appA.runtimeKey,
      },
    );
    expect(runtimeAfter.status).toBe(200);

    const { db } = await initializeDatabase();
    const activeAppKeys = await db
      .select({ id: appKeys.id })
      .from(appKeys)
      .where(and(eq(appKeys.appId, appA.id), eq(appKeys.kind, "app"), isNull(appKeys.revokedAt)))
      .all();
    expect(activeAppKeys).toHaveLength(1);

    const missingApp = await call("POST", ["apps", "app_missing", "app-keys", "rotate"]);
    expect(missingApp.status).toBe(404);
  });

  test("deletes an empty App together with its generated defaults", async () => {
    const response = await call("DELETE", ["apps", appB.id]);
    expect(response.status).toBe(204);
    const missing = await call("GET", ["apps", appB.id]);
    expect(missing.status).toBe(404);
  });

  test("supports token and trusted-proxy deployment authentication", async () => {
    process.env.OPENSCENE_AUTH_MODE = "token";
    process.env.OPENSCENE_MANAGEMENT_TOKEN = "management-test-token";
    resetConfigForTests();
    const missingToken = await call("GET", ["apps"]);
    expect(missingToken.status).toBe(401);
    const validToken = await call("GET", ["apps"], undefined, {
      authorization: "Bearer management-test-token",
    });
    expect(validToken.status).toBe(200);

    const login = await call("POST", ["auth", "session"], { token: "management-test-token" });
    const rotationMissingToken = await call("POST", ["apps", appA.id, "app-keys", "rotate"]);
    expect(rotationMissingToken.status).toBe(401);
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
    expect(cookie).toMatch(/^openscene_admin_session=/);
    const cookieRead = await call("GET", ["apps"], undefined, { cookie: cookie ?? "" });
    expect(cookieRead.status).toBe(200);
    const csrfRejected = await call(
      "PATCH",
      ["apps", appA.id],
      { description: "cookie write" },
      { cookie: cookie ?? "" },
    );
    const rotationCsrfRejected = await call(
      "POST",
      ["apps", appA.id, "app-keys", "rotate"],
      undefined,
      { cookie: cookie ?? "" },
    );
    expect(rotationCsrfRejected.status).toBe(403);
    const rotationCsrfAccepted = await call(
      "POST",
      ["apps", appA.id, "app-keys", "rotate"],
      undefined,
      { cookie: cookie ?? "", origin: "http://localhost" },
    );
    expect(rotationCsrfAccepted.status).toBe(200);
    appA.appKey = (await rotationCsrfAccepted.json()).appKey;
    expect(csrfRejected.status).toBe(403);
    const csrfAccepted = await call(
      "PATCH",
      ["apps", appA.id],
      { description: "cookie write" },
      { cookie: cookie ?? "", origin: "http://localhost" },
    );
    expect(csrfAccepted.status).toBe(200);
    const tamperedCookie = `${cookie?.slice(0, -1)}x`;
    const tampered = await call("GET", ["apps"], undefined, { cookie: tamperedCookie });
    expect(tampered.status).toBe(401);
    const logout = await call("DELETE", ["auth", "session"], undefined, { cookie: cookie ?? "" });
    expect(logout.status).toBe(204);

    process.env.OPENSCENE_AUTH_MODE = "proxy";
    process.env.OPENSCENE_TRUSTED_PROXY_HEADER = "x-authenticated-user";
    process.env.OPENSCENE_TRUSTED_PROXY_VALUE = "admin@example.test";
    resetConfigForTests();
    const forgedProxy = await call("GET", ["apps"], undefined, {
      "x-authenticated-user": "attacker@example.test",
    });
    expect(forgedProxy.status).toBe(401);
    const trustedProxy = await call("GET", ["apps"], undefined, {
      "x-authenticated-user": "admin@example.test",
    });
    expect(trustedProxy.status).toBe(200);

    process.env.OPENSCENE_AUTH_MODE = "disabled";
    resetConfigForTests();
  });

  test("generates deterministic OpenAPI coverage", () => {
    const document = createOpenApiDocument();
    expect(document.openapi).toBe("3.0.3");
    const paths = document.paths as Record<string, unknown>;
    expect(paths["/api/v1/apps/{appId}/documents/{documentId}/draft"]).toBeDefined();
    expect(paths["/api/v1/apps/{appId}/app-keys/rotate"]).toBeDefined();
    expect(paths["/api/v1/runtime/apps/{appKey}/pages/{pageKey}"]).toBeDefined();
    const runtimeOperation = paths["/api/v1/runtime/apps/{appKey}/pages/{pageKey}"] as {
      get: { parameters: Array<{ name: string }> };
    };
    expect(runtimeOperation.get.parameters.map((parameter) => parameter.name)).toEqual([
      "appKey",
      "pageKey",
    ]);
    const authOperation = paths["/api/v1/auth/session"] as {
      get: { responses: Record<string, { content?: Record<string, { schema?: unknown }> }> };
      post: { requestBody: unknown };
      delete: { responses: Record<string, unknown> };
    };
    expect(authOperation.get).toBeDefined();
    expect(authOperation.post.requestBody).toBeDefined();
    expect(authOperation.delete.responses["204"]).toBeDefined();
    const listPreview = paths["/api/v1/apps/{appId}/preview-profiles"] as {
      get: {
        responses: Record<string, { content?: Record<string, { schema?: { type?: string } }> }>;
      };
    };
    expect(listPreview.get.responses["200"].content?.["application/json"].schema).toMatchObject({
      type: "array",
    });
  });
});
describe("App AI prompts", () => {
  beforeAll(() => {
    process.env.OPENSCENE_AUTH_MODE = "disabled";
    resetConfigForTests();
  });

  test("manages multiple prompt profiles per App", async () => {
    // 1. Lists auto-seeded default prompt profile
    const listResponse = await call("GET", ["apps", appA.id, "prompts"]);
    expect(listResponse.status).toBe(200);
    const prompts = await listResponse.json();
    expect(prompts).toHaveLength(1);
    expect(prompts[0].key).toBe("default");
    expect(prompts[0].isDefault).toBe(true);
    expect(prompts[0].system).toBe(DEFAULT_APP_SYSTEM_PROMPT);

    // 2. Creates payment-specific prompt profile
    const createPayment = await call("POST", ["apps", appA.id, "prompts"], {
      key: "payment",
      name: "支付专用",
      description: "支付结算模块专用提示词",
      system: "You are the payment assistant.",
      sections: ["Verify order amount before confirming."],
      injectedComponents: ["button", "input"],
      injectedOpenApiDocIds: [],
      isDefault: false,
      enabled: true,
    });
    expect(createPayment.status).toBe(201);
    const payment = await createPayment.json();
    expect(payment.key).toBe("payment");
    expect(payment.name).toBe("支付专用");
    expect(payment.isDefault).toBe(false);

    // 3. Creates campaign-specific prompt profile as default
    const createCampaign = await call("POST", ["apps", appA.id, "prompts"], {
      key: "campaign",
      name: "活动专用",
      description: "限时促销活动模块提示词",
      system: "You are the marketing campaign assistant.",
      sections: ["Highlight discount codes."],
      isDefault: true,
      enabled: true,
    });
    expect(createCampaign.status).toBe(201);
    const campaign = await createCampaign.json();
    expect(campaign.isDefault).toBe(true);

    // Verify payment is not default, campaign is default
    const refetchedList = await (await call("GET", ["apps", appA.id, "prompts"])).json();
    expect(refetchedList).toHaveLength(3);
    const defaultItem = refetchedList.find((p: { isDefault: boolean }) => p.isDefault);
    expect(defaultItem.key).toBe("campaign");

    // 4. Update payment profile
    const updatePayment = await call("PATCH", ["apps", appA.id, "prompts", payment.id], {
      name: "收银结算专用",
      system: "Updated payment system prompt.",
    });
    expect(updatePayment.status).toBe(200);
    const updatedPayment = await updatePayment.json();
    expect(updatedPayment.name).toBe("收银结算专用");
    expect(updatedPayment.system).toBe("Updated payment system prompt.");

    // 5. Delete payment profile
    const deletePayment = await call("DELETE", ["apps", appA.id, "prompts", payment.id]);
    expect(deletePayment.status).toBe(204);
    const afterDelete = await call("GET", ["apps", appA.id, "prompts", payment.id]);
    expect(afterDelete.status).toBe(404);
  });

  test("requires appId and accepts promptKey on AI chat endpoint", async () => {
    const headers = { "x-openscene-app-key": appA.appKey };
    const missing = await call(
      "POST",
      ["ai", "chat"],
      { messages: [{ role: "user", content: "hello" }] },
      headers,
    );
    expect(missing.status).toBe(422);

    const withAppIdAndModule = await call(
      "POST",
      ["ai", "chat"],
      {
        messages: [{ role: "user", content: "hello" }],
        appId: appA.id,
        promptKey: "campaign",
      },
      headers,
    );
    // appId and promptKey are accepted; fails because AI provider is not configured.
    expect(withAppIdAndModule.status).toBe(403);
  });

  test("returns the default global system prompt", async () => {
    const response = await call("GET", ["ai", "system-prompt"]);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.isDefault).toBe(true);
    expect(body.prompt).toBe(DEFAULT_GLOBAL_SYSTEM_PROMPT);
    expect(body.enabled).toBe(true);
  });

  test("persists and updates the global system prompt", async () => {
    const update = await call("PATCH", ["ai", "system-prompt"], {
      prompt: "Custom global instructions for safety and tone.",
      enabled: true,
    });
    expect(update.status).toBe(200);
    const body = await update.json();
    expect(body.isDefault).toBe(false);
    expect(body.prompt).toBe("Custom global instructions for safety and tone.");
    expect(body.enabled).toBe(true);

    const refetch = await call("GET", ["ai", "system-prompt"]);
    expect(refetch.status).toBe(200);
    expect(await refetch.json()).toEqual(body);
  });
});

async function call(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  segments: string[],
  payload?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const headers = new Headers(extraHeaders);
  if (payload !== undefined) headers.set("content-type", "application/json");
  const request = new NextRequest(
    `http://localhost${segments.length ? `/api/v1/${segments.join("/")}` : "/api/v1"}`,
    { method, headers, body: payload === undefined ? undefined : JSON.stringify(payload) },
  );
  const context: PathContext = { params: Promise.resolve({ path: segments }) };
  if (method === "GET") return GET(request, context);
  if (method === "POST") return POST(request, context);
  if (method === "PATCH") return PATCH(request, context);
  return DELETE(request, context);
}
