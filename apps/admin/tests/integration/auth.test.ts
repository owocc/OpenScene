import { beforeAll, describe, expect, test } from "vite-plus/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET, POST } from "../../app/api/auth/[...all]/route";
import { middleware } from "../../middleware";
import { initializeDatabase, resetDatabaseForTests } from "../../server/db/client";
import { resetConfigForTests } from "../../server/config/env";

let tempDir: string;
const testEmail = `admin-${Date.now()}@openscene.dev`;
const testPassword = "SuperSecretPassword123!";

beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "openscene-auth-"));
  process.env.OPENSCENE_DATABASE_URL = `file:${path.join(tempDir, "test.db")}`;
  process.env.BETTER_AUTH_SECRET = "test-secret-that-is-at-least-32-chars-long";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  resetConfigForTests();
  await resetDatabaseForTests();
  await initializeDatabase();
});

describe("Better Auth Integration & Middleware Protection", () => {
  let sessionCookie = "";

  test("sign up with email and password via auth API", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Test Admin",
        email: testEmail,
        password: testPassword,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(testEmail);
    expect(data.user.name).toBe("Test Admin");
  });

  test("sign in with email and password via auth API", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain("better-auth.session_token");
    sessionCookie = setCookie;
    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(testEmail);
  });

  test("get session via GET request", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/get-session", {
      method: "GET",
      headers: {
        cookie: sessionCookie,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data?.user?.email).toBe(testEmail);
  });

  test("sign out via auth API", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/sign-out", {
      method: "POST",
      headers: {
        cookie: sessionCookie,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  test("middleware redirects unauthenticated users to /login", () => {
    const req = new NextRequest("http://localhost:3000/apps");
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fapps");
  });

  test("middleware allows /login page", () => {
    const req = new NextRequest("http://localhost:3000/login");
    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  test("middleware allows /api/auth routes", () => {
    const req = new NextRequest("http://localhost:3000/api/auth/session");
    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  test("middleware allows protected pages when session cookie is present", () => {
    const req = new NextRequest("http://localhost:3000/apps", {
      headers: {
        cookie: "better-auth.session_token=mock-valid-token-12345",
      },
    });
    const res = middleware(req);
    expect(res.status).toBe(200);
  });
});
