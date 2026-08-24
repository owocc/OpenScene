import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { getConfig } from "../config/env";
import { forbidden, notFound, unauthorized } from "../errors";
import { hashSecret } from "../db/ids";
import { appKeys, studioSessions } from "../db/schema";
import type { AppDatabase } from "../db/client";

export type AuthRequirement =
  | "management"
  | "app-key"
  | "runtime"
  | "session"
  | "client"
  | "public";
export type AuthContext = {
  kind: "management" | "app-key" | "runtime" | "session" | "public";
  appId?: string;
  sessionId?: string;
};

export const UI_SESSION_COOKIE = "openscene_admin_session";
export type UiSessionState = {
  authenticated: boolean;
  mode: "disabled" | "token" | "proxy";
  expiresAt?: string;
};

export async function authenticate(
  request: NextRequest,
  db: AppDatabase,
  requirement: AuthRequirement,
  appId?: string,
): Promise<AuthContext> {
  const config = getConfig();
  if (requirement === "public") return { kind: "public" };

  if (requirement === "management") {
    if (isManagementRequest(request, config)) return { kind: "management" };
    throw unauthorized();
  }

  if (requirement === "app-key") {
    const secret = request.headers.get(config.auth.appKeyHeader);
    if (!secret) throw unauthorized("An App Key is required");
    const key = await db
      .select()
      .from(appKeys)
      .where(
        and(
          eq(appKeys.keyHash, hashSecret(secret)),
          eq(appKeys.kind, "app"),
          isNull(appKeys.revokedAt),
        ),
      )
      .get();
    if (!key || (appId && key.appId !== appId)) throw notFound();
    return { kind: "app-key", appId: key.appId };
  }
  if (requirement === "client") {
    const appKeySecret = request.headers.get(config.auth.appKeyHeader);
    if (appKeySecret) {
      const key = await db
        .select()
        .from(appKeys)
        .where(
          and(
            eq(appKeys.keyHash, hashSecret(appKeySecret)),
            eq(appKeys.kind, "app"),
            isNull(appKeys.revokedAt),
          ),
        )
        .get();
      if (!key || (appId && key.appId !== appId)) throw notFound();
      return { kind: "app-key", appId: key.appId };
    }

    const sessionSecret = request.headers.get("x-openscene-session-token") ?? bearerToken(request);
    if (sessionSecret) {
      const session = await db
        .select()
        .from(studioSessions)
        .where(eq(studioSessions.tokenHash, hashSecret(sessionSecret)))
        .get();
      if (
        session &&
        new Date(session.expiresAt).getTime() > Date.now() &&
        (!appId || session.appId === appId)
      ) {
        return { kind: "session", appId: session.appId, sessionId: session.id };
      }
    }

    if (isManagementRequest(request, config)) return { kind: "management" };
    throw unauthorized("An App Key or valid Studio Session is required");
  }

  if (requirement === "runtime") {
    if (config.auth.runtimePublic) return { kind: "public" };
    const secret = request.headers.get(config.auth.runtimeKeyHeader) ?? bearerToken(request);
    if (!secret) throw unauthorized("A Runtime Key is required");
    const key = await db
      .select()
      .from(appKeys)
      .where(
        and(
          eq(appKeys.keyHash, hashSecret(secret)),
          eq(appKeys.kind, "runtime"),
          isNull(appKeys.revokedAt),
        ),
      )
      .get();
    if (!key || (appId && key.appId !== appId)) throw notFound();
    return { kind: "runtime", appId: key.appId };
  }

  const sessionSecret = request.headers.get("x-openscene-session-token") ?? bearerToken(request);
  if (sessionSecret) {
    const session = await db
      .select()
      .from(studioSessions)
      .where(eq(studioSessions.tokenHash, hashSecret(sessionSecret)))
      .get();
    if (
      session &&
      new Date(session.expiresAt).getTime() > Date.now() &&
      (!appId || session.appId === appId)
    ) {
      return { kind: "session", appId: session.appId, sessionId: session.id };
    }
  }
  if (isManagementRequest(request, config)) return { kind: "management" };
  throw unauthorized("A valid Studio Session is required");
}

export function assertAppContext(context: AuthContext, appId: string): void {
  if (context.appId && context.appId !== appId) throw forbidden();
}

export function getUiSessionState(request: NextRequest): UiSessionState {
  const config = getConfig();
  if (config.auth.mode !== "token") {
    return { authenticated: true, mode: config.auth.mode };
  }
  const session = readUiSession(request, config);
  return {
    authenticated: Boolean(session),
    mode: config.auth.mode,
    ...(session ? { expiresAt: new Date(session.expiresAt).toISOString() } : {}),
  };
}

export function createUiSessionCookie(request: NextRequest): {
  value: string;
  expiresAt: string;
} {
  const config = getConfig();
  if (config.auth.mode !== "token" || !config.auth.managementToken) {
    throw unauthorized("UI sessions require token authentication");
  }
  const expiresAtMs = Date.now() + config.studio.uiSessionTtlSeconds * 1_000;
  const payload = `${expiresAtMs}.${randomBytes(18).toString("base64url")}`;
  const signature = signUiSession(payload, config.auth.managementToken);
  const secure = request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
  return {
    value: `${UI_SESSION_COOKIE}=${payload}.${signature}; Path=/; Max-Age=${Math.floor(config.studio.uiSessionTtlSeconds)}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export function clearUiSessionCookie(request: NextRequest): string {
  const secure = request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
  return `${UI_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

export function assertManagementCsrf(request: NextRequest, method: Method): void {
  if (method === "GET") return;
  if (bearerToken(request) || !isUiSessionRequest(request)) return;
  const origin = request.headers.get("origin");
  const config = getConfig();
  if (
    !origin ||
    (origin !== request.nextUrl.origin && !config.auth.managementOrigins.includes(origin))
  ) {
    throw forbidden("A same-origin or configured management Origin is required");
  }
}

function isManagementRequest(request: NextRequest, config: ReturnType<typeof getConfig>): boolean {
  if (config.auth.mode === "disabled") return true;
  if (config.auth.mode === "token")
    return (
      bearerToken(request) === config.auth.managementToken ||
      Boolean(readUiSession(request, config))
    );
  return request.headers.get(config.auth.trustedProxyHeader) === config.auth.trustedProxyValue;
}

function isUiSessionRequest(request: NextRequest): boolean {
  return Boolean(request.cookies.get(UI_SESSION_COOKIE)?.value);
}

function readUiSession(
  request: NextRequest,
  config: ReturnType<typeof getConfig>,
): { expiresAt: number } | undefined {
  if (config.auth.mode !== "token" || !config.auth.managementToken) return undefined;
  const value = request.cookies.get(UI_SESSION_COOKIE)?.value;
  if (!value) return undefined;
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return undefined;
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = signUiSession(payload, config.auth.managementToken);
  if (!safeEqual(signature, expected)) return undefined;
  const payloadSeparator = payload.indexOf(".");
  if (payloadSeparator <= 0) return undefined;
  const expiresAt = Number(payload.slice(0, payloadSeparator));
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return undefined;
  return { expiresAt };
}

function signUiSession(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function bearerToken(request: NextRequest): string | undefined {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) return undefined;
  return value.slice("Bearer ".length).trim() || undefined;
}
