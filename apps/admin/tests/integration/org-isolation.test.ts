import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET as authGet, POST as authPost } from "../../app/api/auth/[...all]/route";
import {
  GET as apiGet,
  PATCH as apiPatch,
  POST as apiPost,
} from "../../app/api/v1/[...path]/route";
import { initializeDatabase, resetDatabaseForTests } from "../../server/db/client";
import { resetConfigForTests } from "../../server/config/env";
import { resetStorageForTests } from "../../server/storage";
import { APP_TYPE_WEB } from "@openscene-ai/core";

let tempDir: string;

beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "openscene-org-isolation-"));
  process.env.OPENSCENE_DATABASE_URL = `file:${path.join(tempDir, "test.db")}`;
  process.env.OPENSCENE_AUTH_MODE = "disabled";
  process.env.OPENSCENE_STORAGE_DRIVER = "memory";
  process.env.BETTER_AUTH_SECRET = "test-secret-that-is-at-least-32-chars-long";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  resetConfigForTests();
  resetStorageForTests();
  await resetDatabaseForTests();
  await initializeDatabase();
});

afterAll(async () => {
  await resetDatabaseForTests();
  resetStorageForTests();
  resetConfigForTests();
});

describe("SaaS Multi-Organization Data Isolation & Permissions", () => {
  let userACookie = "";
  let userBCookie = "";
  let orgAId = "";
  let _orgBId = "";
  let appAId = "";

  const userAEmail = `userA-${Date.now()}@example.com`;
  const userBEmail = `userB-${Date.now()}@example.com`;
  const password = "SuperSecretPassword123!";

  test("User A registers and creates Organization A", async () => {
    // 1. User A Sign up
    const signUpReq = new NextRequest("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "User A", email: userAEmail, password }),
    });
    const signUpRes = await authPost(signUpReq);
    expect(signUpRes.status).toBe(200);
    const setCookie = signUpRes.headers.get("set-cookie") || "";
    userACookie = setCookie;

    // 1b. User A has no organization yet -> Access to /api/v1/apps or /api/v1/ai/config is forbidden (403)
    const initialAppsReq = new NextRequest("http://localhost:3000/api/v1/apps", {
      method: "GET",
      headers: { cookie: userACookie },
    });
    const initialAppsRes = await apiGet(initialAppsReq, {
      params: Promise.resolve({ path: ["apps"] }),
    });
    expect(initialAppsRes.status).toBe(403);

    // 2. User A creates Organization A
    const createOrgReq = new NextRequest("http://localhost:3000/api/auth/organization/create", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: userACookie },
      body: JSON.stringify({ name: "Organization A", slug: `org-a-${Date.now()}` }),
    });
    const createOrgRes = await authPost(createOrgReq);
    expect(createOrgRes.status).toBe(200);
    const orgA = await createOrgRes.json();
    orgAId = orgA.id;
    expect(orgAId).toBeDefined();

    // Verify session has activeOrganizationId = orgAId
    const sessionReq = new NextRequest("http://localhost:3000/api/auth/get-session", {
      method: "GET",
      headers: { cookie: userACookie },
    });
    const sessionRes = await authGet(sessionReq);
    const sessionData = await sessionRes.json();
    expect(sessionData?.session?.activeOrganizationId).toBe(orgAId);
  });

  test("User A creates App A in Organization A", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/apps", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: userACookie },
      body: JSON.stringify({
        key: "app-a",
        name: "App A",
        type: APP_TYPE_WEB,
        manifest: { mode: "push" },
      }),
    });
    const res = await apiPost(req, { params: Promise.resolve({ path: ["apps"] }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    appAId = body.id;
    expect(body.organizationId).toBe(orgAId);
  });

  test("User A sets Organization A AI configuration", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/ai/config", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: userACookie },
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-4o",
        apiKey: "sk-user-a-secret-key",
        enabled: true,
      }),
    });
    const res = await apiPatch(req, { params: Promise.resolve({ path: ["ai", "config"] }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.model).toBe("gpt-4o");
    expect(body.enabled).toBe(true);
  });

  test("User B registers and creates Organization B", async () => {
    // 1. User B Sign up
    const signUpReq = new NextRequest("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "User B", email: userBEmail, password }),
    });
    const signUpRes = await authPost(signUpReq);
    expect(signUpRes.status).toBe(200);
    userBCookie = signUpRes.headers.get("set-cookie") || "";

    // 2. User B creates Organization B
    const createOrgReq = new NextRequest("http://localhost:3000/api/auth/organization/create", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: userBCookie },
      body: JSON.stringify({ name: "Organization B", slug: `org-b-${Date.now()}` }),
    });
    const createOrgRes = await authPost(createOrgReq);
    expect(createOrgRes.status).toBe(200);
    const orgB = await createOrgRes.json();
    _orgBId = orgB.id;
  });

  test("User B cannot see or modify User A's apps or AI config", async () => {
    // 1. User B lists apps -> 0 items
    const listReq = new NextRequest("http://localhost:3000/api/v1/apps", {
      method: "GET",
      headers: { cookie: userBCookie },
    });
    const listRes = await apiGet(listReq, { params: Promise.resolve({ path: ["apps"] }) });
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.items).toEqual([]);

    // 2. User B tries to GET App A -> 404
    const getAppReq = new NextRequest(`http://localhost:3000/api/v1/apps/${appAId}`, {
      method: "GET",
      headers: { cookie: userBCookie },
    });
    const getAppRes = await apiGet(getAppReq, {
      params: Promise.resolve({ path: ["apps", appAId] }),
    });
    expect(getAppRes.status).toBe(404);

    // 3. User B tries to PATCH App A -> 404
    const patchAppReq = new NextRequest(`http://localhost:3000/api/v1/apps/${appAId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: userBCookie },
      body: JSON.stringify({ name: "Hacked by B" }),
    });
    const patchAppRes = await apiPatch(patchAppReq, {
      params: Promise.resolve({ path: ["apps", appAId] }),
    });
    expect(patchAppRes.status).toBe(404);

    // 4. User B gets AI config in Org B -> unconfigured (does not see Org A's AI config)
    const getAiReq = new NextRequest("http://localhost:3000/api/v1/ai/config", {
      method: "GET",
      headers: { cookie: userBCookie },
    });
    const getAiRes = await apiGet(getAiReq, {
      params: Promise.resolve({ path: ["ai", "config"] }),
    });
    expect(getAiRes.status).toBe(200);
    const aiBody = await getAiRes.json();
    expect(aiBody.configured).toBe(false);
  });

  test("Invitation flow: User A invites User B to Org A as read-only member", async () => {
    // 1. User A invites User B
    const inviteReq = new NextRequest("http://localhost:3000/api/auth/organization/invite-member", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: userACookie },
      body: JSON.stringify({ email: userBEmail, role: "member" }),
    });
    const inviteRes = await authPost(inviteReq);
    expect(inviteRes.status).toBe(200);
    const inviteData = await inviteRes.json();
    const invitationId = inviteData.id;

    // 2. User B accepts invitation
    const acceptReq = new NextRequest(
      "http://localhost:3000/api/auth/organization/accept-invitation",
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: userBCookie },
        body: JSON.stringify({ invitationId }),
      },
    );
    const acceptRes = await authPost(acceptReq);
    expect(acceptRes.status).toBe(200);

    // 3. User B switches active organization to Org A
    const setOrgReq = new NextRequest("http://localhost:3000/api/auth/organization/set-active", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: userBCookie },
      body: JSON.stringify({ organizationId: orgAId }),
    });
    const setOrgRes = await authPost(setOrgReq);
    expect(setOrgRes.status).toBe(200);

    // 4. User B now lists apps in Org A -> Sees App A (read access granted)
    const listReq = new NextRequest("http://localhost:3000/api/v1/apps", {
      method: "GET",
      headers: { cookie: userBCookie },
    });
    const listRes = await apiGet(listReq, { params: Promise.resolve({ path: ["apps"] }) });
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.items.some((app: { id: string }) => app.id === appAId)).toBe(true);

    // 5. User B attempts to edit App A -> 403 Forbidden (member role is read-only)
    const patchReq = new NextRequest(`http://localhost:3000/api/v1/apps/${appAId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: userBCookie },
      body: JSON.stringify({ name: "Attempted Edit by Member" }),
    });
    const patchRes = await apiPatch(patchReq, {
      params: Promise.resolve({ path: ["apps", appAId] }),
    });
    expect(patchRes.status).toBe(403);
  });
});
