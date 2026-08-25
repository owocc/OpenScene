import { and, eq, isNull } from "drizzle-orm";
import { APP_TYPE_WEB } from "@openscene-ai/constants";
import { createEmptySceneDocument } from "@openscene-ai/protocol";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { DELETE, GET, PATCH, POST, PUT } from "../../app/api/v1/[...path]/route";
import { initializeDatabase, resetDatabaseForTests } from "../../server/db/client";
import { appKeys, appStorageConfigs } from "../../server/db/schema";
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
      status: "published",
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

  test("initializes Page document from Template draft when versionId is omitted", async () => {
    const template = await call("POST", ["apps", appA.id, "templates"], {
      key: "card-template",
      title: "Card Template",
      status: "published",
    });
    expect(template.status).toBe(201);
    const templateBody = await template.json();

    // Update template draft document with custom content
    const customDoc = {
      schemaVersion: "1.0.0",
      pageInfo: {
        title: "Custom Template",
        description: "Template Desc",
        keywords: [],
        locale: "en-US",
        metadata: {},
      },
      globalConfig: {},
      spec: {
        root: "root",
        elements: {
          root: { type: "View", props: { style: { padding: 16 } }, children: ["text1"] },
          text1: { type: "Text", props: { content: "Hello from Template" }, children: [] },
        },
        state: {},
      },
    };
    const updateDraftRes = await call(
      "PATCH",
      ["apps", appA.id, "documents", templateBody.documentId, "draft"],
      { baseRevision: 0, document: customDoc },
    );
    expect(updateDraftRes.status).toBe(200);

    // Create page from template (selecting template ID only)
    const page = await call("POST", ["apps", appA.id, "pages"], {
      key: "page-from-template-draft",
      title: "Page From Template Draft",
      sourceTemplate: { templateId: templateBody.id },
    });
    expect(page.status).toBe(201);
    const pageBody = await page.json();
    expect(pageBody.sourceTemplate).toEqual({
      templateId: templateBody.id,
      versionId: null,
    });

    // Verify page's initial document is copied from the template
    const pageDraft = await call("GET", [
      "apps",
      appA.id,
      "documents",
      pageBody.documentId,
      "draft",
    ]);
    expect(pageDraft.status).toBe(200);
    const pageDraftBody = await pageDraft.json();
    expect(pageDraftBody.document).toEqual(customDoc);

    // Verify sourceTemplate cannot be modified via PATCH
    const patchRes = await call("PATCH", ["apps", appA.id, "pages", pageBody.id], {
      title: "Updated Title",
      sourceTemplate: { templateId: "other-template" },
    });
    expect(patchRes.status).toBe(200);
    const patchedPage = await patchRes.json();
    expect(patchedPage.title).toBe("Updated Title");
    expect(patchedPage.sourceTemplate).toEqual({
      templateId: templateBody.id,
      versionId: null,
    });
  });
  test("templates cannot be published as releases and support version management", async () => {
    // 0. Active status is not allowed for templates
    const invalidStatus = await call("POST", ["apps", appA.id, "templates"], {
      key: "tpl-invalid",
      title: "Template Invalid",
      status: "active",
    });
    expect(invalidStatus.status).toBe(422);

    // 0b. Draft templates cannot be used to create pages
    const draftTpl = await (
      await call("POST", ["apps", appA.id, "templates"], {
        key: "tpl-draft",
        title: "Template Draft",
        status: "draft",
      })
    ).json();
    const draftPageAttempt = await call("POST", ["apps", appA.id, "pages"], {
      key: "page-from-draft",
      title: "Page From Draft",
      sourceTemplate: { templateId: draftTpl.id },
    });
    expect(draftPageAttempt.status).toBe(422);

    // 1. Create a published template
    const tplRes = await call("POST", ["apps", appA.id, "templates"], {
      key: "tpl-versioned",
      title: "Template Versioned",
      status: "published",
    });
    expect(tplRes.status).toBe(201);
    const tpl = await tplRes.json();
    expect(tpl.currentVersionId).toBeNull();

    // 2. Create version 1 for template
    const v1Res = await call("POST", ["apps", appA.id, "documents", tpl.documentId, "versions"], {
      message: "Version 1",
    });
    expect(v1Res.status).toBe(201);
    const v1 = await v1Res.json();

    // Template currentVersionId automatically updated to first created version
    const tplAfterV1 = await (await call("GET", ["apps", appA.id, "templates", tpl.id])).json();
    expect(tplAfterV1.currentVersionId).toBe(v1.id);

    // 3. Create version 2 for template
    const v2Res = await call("POST", ["apps", appA.id, "documents", tpl.documentId, "versions"], {
      message: "Version 2",
    });
    expect(v2Res.status).toBe(201);
    const v2 = await v2Res.json();

    // 4. Manually set version 2 as current version
    const setCurRes = await call("PATCH", ["apps", appA.id, "templates", tpl.id], {
      currentVersionId: v2.id,
    });
    expect(setCurRes.status).toBe(200);
    expect((await setCurRes.json()).currentVersionId).toBe(v2.id);

    // 5. Create a page choosing the template without versionId -> automatically uses template currentVersion (v2)
    const pageAutoV2Res = await call("POST", ["apps", appA.id, "pages"], {
      key: "page-auto-v2",
      title: "Page Auto V2",
      sourceTemplate: { templateId: tpl.id },
    });
    const pageAutoV2 = await pageAutoV2Res.json();
    expect(pageAutoV2Res.status).toBe(201);
    expect(pageAutoV2.sourceTemplate.versionId).toBe(v2.id);
    // 6. Create a page explicitly choosing v1
    const pageWithV1 = await (
      await call("POST", ["apps", appA.id, "pages"], {
        key: "page-explicit-v1",
        title: "Page Explicit V1",
        sourceTemplate: { templateId: tpl.id, versionId: v1.id },
      })
    ).json();
    expect(pageWithV1.sourceTemplate.versionId).toBe(v1.id);

    // 7. Verify templates cannot create releases (publishing is not allowed for templates)
    const releaseAttempt = await call(
      "POST",
      ["apps", appA.id, "documents", tpl.documentId, "releases"],
      { versionId: v2.id },
    );
    expect(releaseAttempt.status).toBe(422);

    // 8. Version deletion conflict: v1 cannot be deleted because it is referenced by pageWithV1
    const delConflict = await call("DELETE", [
      "apps",
      appA.id,
      "documents",
      tpl.documentId,
      "versions",
      v1.id,
    ]);
    expect(delConflict.status).toBe(409);
    // 8b. Current version deletion conflict: v2 is current version of template and cannot be deleted
    const delCurrentConflict = await call("DELETE", [
      "apps",
      appA.id,
      "documents",
      tpl.documentId,
      "versions",
      v2.id,
    ]);
    expect(delCurrentConflict.status).toBe(409);

    // 9. Create an unreferenced version 3 and delete it
    const v3 = await (
      await call("POST", ["apps", appA.id, "documents", tpl.documentId, "versions"], {
        message: "Version 3",
      })
    ).json();

    const delV3 = await call("DELETE", [
      "apps",
      appA.id,
      "documents",
      tpl.documentId,
      "versions",
      v3.id,
    ]);
    expect(delV3.status).toBe(204);

    const getV3 = await call("GET", [
      "apps",
      appA.id,
      "documents",
      tpl.documentId,
      "versions",
      v3.id,
    ]);
    expect(getV3.status).toBe(404);
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

  test("inspects and assembles complete system prompt via prompt-preview endpoint", async () => {
    const response = await call(
      "POST",
      ["ai", "prompt-preview"],
      {
        appId: appA.id,
        promptKey: "default",
        selectedElement: {
          nodeId: "button-1",
          type: "Button",
          props: { label: "Click me" },
        },
      },
      { "x-openscene-app-key": appA.appKey },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.systemPrompt).toBe("string");
    expect(body.systemPrompt).toContain("TARGETED ELEMENT MODIFICATION RULES");
    expect(body.systemPrompt).toContain("button-1");
    expect(body.breakdown).toBeDefined();
    expect(body.breakdown.selectedElementText).toContain("button-1");
  });
});
describe("App Storage binding & encryption", () => {
  beforeAll(() => {
    process.env.OPENSCENE_AUTH_MODE = "disabled";
    resetConfigForTests();
  });

  test("manages dedicated storage configuration per app with encrypted secret key", async () => {
    // 1. Initial state: storage not configured
    const initial = await call("GET", ["apps", appA.id, "storage"]);
    expect(initial.status).toBe(200);
    const initialBody = await initial.json();
    expect(initialBody.configured).toBe(false);

    // 2. Configure S3 storage for App A
    const saveRes = await call("PUT", ["apps", appA.id, "storage"], {
      driver: "s3",
      bucket: "app-a-bucket",
      endpoint: "http://45.205.31.54:4566",
      region: "us-east-1",
      accessKeyId: "key-a-123",
      secretAccessKey: "super-secret-s3-key-value",
      forcePathStyle: true,
      publicBaseUrl: "https://cdn.app-a.com",
    });
    expect(saveRes.status).toBe(200);
    const saved = await saveRes.json();
    expect(saved.appId).toBe(appA.id);
    expect(saved.bucket).toBe("app-a-bucket");
    expect(saved.accessKeyId).toBe("key-a-123");
    expect(saved.hasSecretAccessKey).toBe(true);
    expect(saved.secretAccessKey).toBeUndefined(); // Secret key must not be returned!
    expect(saved.publicBaseUrl).toBe("https://cdn.app-a.com");

    // 3. Verify DB record: secret is encrypted at rest (contains iv.authTag.ciphertext format)
    const { db } = await initializeDatabase();
    const dbRow = await db
      .select()
      .from(appStorageConfigs)
      .where(eq(appStorageConfigs.appId, appA.id))
      .get();
    expect(dbRow).toBeDefined();
    expect(dbRow?.secretAccessKeyEnc).toBeDefined();
    expect(dbRow?.secretAccessKeyEnc).not.toBe("super-secret-s3-key-value");
    expect(dbRow?.secretAccessKeyEnc?.split(".")).toHaveLength(3);

    // 4. Retrieve storage config via GET: secret key is never exposed
    const getRes = await call("GET", ["apps", appA.id, "storage"]);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.configured).toBe(true);
    expect(getBody.config.bucket).toBe("app-a-bucket");
    expect(getBody.config.accessKeyId).toBe("key-a-123");
    expect(getBody.config.hasSecretAccessKey).toBe(true);
    expect(getBody.config.secretAccessKey).toBeUndefined();

    // 5. Update storage configuration without providing secretAccessKey (preserves existing secret)
    const updateRes = await call("PUT", ["apps", appA.id, "storage"], {
      driver: "s3",
      bucket: "app-a-bucket-updated",
      endpoint: "http://45.205.31.54:4566",
      region: "us-east-2",
      accessKeyId: "key-a-updated",
      forcePathStyle: false,
    });
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.bucket).toBe("app-a-bucket-updated");
    expect(updated.region).toBe("us-east-2");
    expect(updated.accessKeyId).toBe("key-a-updated");
    expect(updated.hasSecretAccessKey).toBe(true);
    expect(updated.forcePathStyle).toBe(false);

    // Verify secret in DB was preserved
    const updatedDbRow = await db
      .select()
      .from(appStorageConfigs)
      .where(eq(appStorageConfigs.appId, appA.id))
      .get();
    expect(updatedDbRow?.secretAccessKeyEnc).toBe(dbRow?.secretAccessKeyEnc);

    // 6. Test storage connection endpoint
    const testRes = await call("POST", ["apps", appA.id, "storage", "test"], {
      driver: "memory",
    });
    expect(testRes.status).toBe(200);
    const testBody = await testRes.json();
    expect(testBody.status).toBe("up");

    // 7. Delete storage configuration
    const delRes = await call("DELETE", ["apps", appA.id, "storage"]);
    expect(delRes.status).toBe(204);

    const postDelete = await call("GET", ["apps", appA.id, "storage"]);
    expect(postDelete.status).toBe(200);
    expect((await postDelete.json()).configured).toBe(false);
  });
  test("supports database storage mode storing releases directly in DB", async () => {
    // 1. Configure App A for database storage mode
    const saveDbMode = await call("PUT", ["apps", appA.id, "storage"], {
      driver: "database",
    });
    expect(saveDbMode.status).toBe(200);
    const saved = await saveDbMode.json();
    expect(saved.driver).toBe("database");
    expect(saved.bucket).toBeNull();
    expect(saved.hasSecretAccessKey).toBe(false);

    // 2. Check health in database mode
    const healthRes = await call("GET", ["apps", appA.id, "storage", "health"]);
    expect(healthRes.status).toBe(200);
    const healthBody = await healthRes.json();
    expect(healthBody.status).toBe("up");
    expect(healthBody.driver).toBe("database");

    // 3. Test storage in database mode returns up
    const testRes = await call("POST", ["apps", appA.id, "storage", "test"], {
      driver: "database",
    });
    expect(testRes.status).toBe(200);
    expect((await testRes.json()).status).toBe("up");
  });
  test("allows configuring S3 independently with pageDriver database while requiring S3 for assets", async () => {
    // 1. Create a dedicated app
    const appRes = await call("POST", ["apps"], {
      key: "app-s3-test",
      name: "App S3 Test",
      type: APP_TYPE_WEB,
    });
    expect(appRes.status).toBe(201);
    const appS3 = await appRes.json();

    // 2. Configure S3 for App with pageDriver set to database
    const saveRes = await call("PUT", ["apps", appS3.id, "storage"], {
      pageDriver: "database",
      s3Enabled: true,
      bucket: "app-s3-assets",
      endpoint: "http://45.205.31.54:4566",
      region: "us-east-1",
      accessKeyId: "key-s3-123",
      secretAccessKey: "secret-key-s3",
      forcePathStyle: true,
      publicBaseUrl: "https://assets.app-s3.com",
    });
    expect(saveRes.status).toBe(200);
    const saved = await saveRes.json();
    expect(saved.pageDriver).toBe("database");
    expect(saved.s3Enabled).toBe(true);
    expect(saved.bucket).toBe("app-s3-assets");

    // 3. Upload asset uses S3 directory structure
    const assetIntent = await call("POST", ["apps", appS3.id, "assets", "upload-intents"], {
      fileName: "picture.png",
      mimeType: "image/png",
      size: 512,
      folder: "/photos",
    });
    expect(assetIntent.status).toBe(201);
    const assetData = await assetIntent.json();
    expect(assetData.asset.storageKey).toContain(`apps/${appS3.id}/assets/photos/`);
    // 4. Attempting to switch pageDriver to s3 when S3 is not enabled/configured fails with 400
    const invalidSwitch = await call("PUT", ["apps", appS3.id, "storage"], {
      pageDriver: "s3",
      s3Enabled: false,
    });
    expect(invalidSwitch.status).toBe(422);
  });

  test("global storage is deprecated and reports status in health check", async () => {
    const health = await call("GET", ["health"]);
    expect(health.status).toBe(200);
    const healthBody = await health.json();
    expect(healthBody.status).toBe("ok");
    expect(healthBody.storage.status).toBe("deprecated");

    const storageHealth = await call("GET", ["storage", "health"]);
    expect(storageHealth.status).toBe(200);
    const storageHealthBody = await storageHealth.json();
    expect(storageHealthBody.status).toBe("deprecated");
  });
});
describe("Asset Management & Categorization", () => {
  test("supports image, audio, video upload intents with folder, tags, and metadata", async () => {
    const testAppId = appA.id;
    // 1. Create upload intent for an image with folder and tags
    const imageIntentRes = await call("POST", ["apps", testAppId, "assets", "upload-intents"], {
      fileName: "hero.png",
      mimeType: "image/png",
      size: 1024,
      folder: "/images/banners",
      tags: ["banner", "hero", "homepage"],
      metadata: { theme: "dark" },
    });
    if (imageIntentRes.status !== 201) {
      console.error("imageIntentRes error:", await imageIntentRes.json());
    }
    expect(imageIntentRes.status).toBe(201);
    const imageIntent = await imageIntentRes.json();
    expect(imageIntent.asset.folder).toBe("/images/banners");
    expect(imageIntent.asset.tags).toEqual(["banner", "hero", "homepage"]);
    expect(imageIntent.asset.status).toBe("pending");
    expect(imageIntent.uploadUrl).toBeDefined();

    // 2. Upload bytes via local upload endpoint
    const uploadRes = await call(
      "PUT",
      ["apps", testAppId, "assets", "upload"],
      new Uint8Array(1024),
      { "content-type": "image/png" },
      `key=${encodeURIComponent(imageIntent.asset.storageKey)}`,
    );
    expect(uploadRes.status).toBe(200);
    // 3. Complete the asset with image width, height
    const completeImageRes = await call(
      "POST",
      ["apps", testAppId, "assets", imageIntent.asset.id, "complete"],
      {
        width: 1920,
        height: 1080,
      },
    );
    expect(completeImageRes.status).toBe(200);
    const completedImage = await completeImageRes.json();
    expect(completedImage.status).toBe("ready");
    expect(completedImage.width).toBe(1920);
    expect(completedImage.height).toBe(1080);
    expect(completedImage.path).toContain(
      `/api/v1/apps/${testAppId}/assets/${imageIntent.asset.id}/raw`,
    );

    // 4. Create upload intent for audio with duration
    const audioIntentRes = await call("POST", ["apps", testAppId, "assets", "upload-intents"], {
      fileName: "soundtrack.mp3",
      mimeType: "audio/mp3",
      size: 2048,
      folder: "/audio",
      tags: ["bgm", "theme"],
    });
    expect(audioIntentRes.status).toBe(201);
    const audioIntent = await audioIntentRes.json();
    const uploadAudioRes = await call(
      "PUT",
      ["apps", testAppId, "assets", "upload"],
      new Uint8Array(2048),
      { "content-type": "audio/mp3" },
      `key=${encodeURIComponent(audioIntent.asset.storageKey)}`,
    );
    expect(uploadAudioRes.status).toBe(200);

    const completeAudioRes = await call(
      "POST",
      ["apps", testAppId, "assets", audioIntent.asset.id, "complete"],
      {
        duration: 125,
      },
    );
    expect(completeAudioRes.status).toBe(200);
    const completedAudio = await completeAudioRes.json();
    expect(completedAudio.duration).toBe(125);
    expect(completedAudio.mimeType).toBe("audio/mp3");

    // 5. Test listing distinct folders
    const foldersRes = await call("GET", ["apps", testAppId, "assets", "folders"]);
    expect(foldersRes.status).toBe(200);
    const folders = await foldersRes.json();
    expect(folders).toContain("/");
    expect(folders).toContain("/images/banners");
    expect(folders).toContain("/audio");

    // 6. Test filtering by folder
    const bannerListRes = await call(
      "GET",
      ["apps", testAppId, "assets"],
      undefined,
      {},
      `folder=/images/banners`,
    );
    expect(bannerListRes.status).toBe(200);
    const bannerAssets = await bannerListRes.json();
    expect(bannerAssets.length).toBeGreaterThanOrEqual(1);
    expect(bannerAssets[0].folder).toBe("/images/banners");

    // 7. Test PATCH asset (moving folder & updating tags)
    const patchRes = await call("PATCH", ["apps", testAppId, "assets", imageIntent.asset.id], {
      folder: "/images/featured",
      tags: ["featured", "hero"],
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.folder).toBe("/images/featured");
    expect(patched.tags).toEqual(["featured", "hero"]);

    // 8. Test raw streaming endpoint
    const rawRes = await call("GET", ["apps", testAppId, "assets", imageIntent.asset.id, "raw"]);
    expect(rawRes.status).toBe(200);
    expect(rawRes.headers.get("content-type")).toBe("image/png");
    expect(rawRes.headers.get("cache-control")).toContain("public");
  });
});

async function call(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  segments: string[],
  payload?: unknown,
  extraHeaders: Record<string, string> = {},
  query?: string,
): Promise<Response> {
  const headers = new Headers(extraHeaders);
  let bodyData: BodyInit | undefined = undefined;
  if (payload instanceof Uint8Array) {
    bodyData = payload as unknown as BodyInit;
  } else if (payload !== undefined) {
    headers.set("content-type", "application/json");
    bodyData = JSON.stringify(payload);
  }
  const qs = query ? `?${query}` : "";
  const request = new NextRequest(
    `http://localhost${segments.length ? `/api/v1/${segments.join("/")}` : "/api/v1"}${qs}`,
    { method, headers, body: bodyData },
  );
  const context: PathContext = { params: Promise.resolve({ path: segments }) };
  if (method === "GET") return GET(request, context);
  if (method === "POST") return POST(request, context);
  if (method === "PATCH") return PATCH(request, context);
  if (method === "PUT") return PUT(request, context);
  return DELETE(request, context);
}
