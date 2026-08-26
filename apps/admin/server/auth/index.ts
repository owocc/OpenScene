import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getAuth } from "../../lib/auth";
import { defaultRoleStatements, hasStatement } from "../../lib/permissions";
import { getConfig } from "../config/env";
import { forbidden, notFound, unauthorized, ProblemError } from "../errors";
import { hashSecret } from "../db/ids";
import { apps, member, organization, organizationRole, studioSessions } from "../db/schema";
import { initializeDatabase, type AppDatabase } from "../db/client";

export type AuthRequirement = "management" | "publish-key" | "session" | "client" | "public";
export type AuthContext = {
  kind: "management" | "publish-key" | "session" | "public";
  appId?: string;
  sessionId?: string;
  organizationId?: string;
  role?: string;
  statements?: Record<string, readonly string[]>;
};

export async function getServerSessionAndOrganizations(): Promise<{
  isAuthenticated: boolean;
  userId?: string;
  activeOrgId?: string;
  organizations: Array<{ id: string; name: string; slug: string; role: string }>;
  isAuthDisabled: boolean;
}> {
  const config = getConfig();
  if (config.auth.mode === "disabled") {
    return {
      isAuthenticated: true,
      isAuthDisabled: true,
      organizations: [
        { id: "org_default", name: "Default Organization", slug: "default", role: "owner" },
      ],
    };
  }

  let reqHeaders: Headers;
  try {
    reqHeaders = await headers();
  } catch {
    return {
      isAuthenticated: false,
      isAuthDisabled: false,
      organizations: [],
    };
  }

  const sessionResult = await getAuth().api.getSession({
    headers: reqHeaders,
  });

  if (!sessionResult?.session || !sessionResult?.user) {
    return {
      isAuthenticated: false,
      isAuthDisabled: false,
      organizations: [],
    };
  }

  const { db } = await initializeDatabase();
  const userId = sessionResult.user.id;
  const activeOrgId =
    (sessionResult.session as { activeOrganizationId?: string | null }).activeOrganizationId ??
    undefined;

  const memberOrgs = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId));

  return {
    isAuthenticated: true,
    isAuthDisabled: false,
    userId,
    activeOrgId,
    organizations: memberOrgs,
  };
}

export async function resolveDefaultOrganizationId(db: AppDatabase): Promise<string> {
  const org = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, "default"))
    .get();
  if (!org) {
    throw new ProblemError({
      title: "Internal Server Error",
      status: 500,
      detail: "Default organization not found",
    });
  }
  return org.id;
}

export async function resolveSessionOrganization(
  db: AppDatabase,
  request: NextRequest,
): Promise<{
  organizationId: string;
  role: string;
  statements: Record<string, readonly string[]>;
  userId: string;
}> {
  const sessionResult = await getAuth().api.getSession({
    headers: request.headers,
  });

  if (!sessionResult?.session) {
    throw unauthorized("A valid session is required");
  }

  const activeOrgId = (sessionResult.session as { activeOrganizationId?: string | null })
    .activeOrganizationId;
  if (!activeOrgId) {
    throw forbidden("No active organization selected");
  }

  const memberRow = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, activeOrgId), eq(member.userId, sessionResult.user.id)))
    .get();

  if (!memberRow) {
    throw forbidden("You are not a member of the active organization");
  }

  let roleStatements: Record<string, readonly string[]> | undefined;
  if (memberRow.role in defaultRoleStatements) {
    roleStatements = defaultRoleStatements[memberRow.role];
  } else {
    const customRoleRow = await db
      .select({ permission: organizationRole.permission })
      .from(organizationRole)
      .where(
        and(
          eq(organizationRole.organizationId, activeOrgId),
          eq(organizationRole.role, memberRow.role),
        ),
      )
      .get();
    if (customRoleRow) {
      try {
        roleStatements =
          typeof customRoleRow.permission === "string"
            ? JSON.parse(customRoleRow.permission)
            : customRoleRow.permission;
      } catch {
        roleStatements = undefined;
      }
    }
  }

  if (!roleStatements) {
    throw forbidden(`Role "${memberRow.role}" does not have valid permissions configured`);
  }

  return {
    organizationId: activeOrgId,
    role: memberRow.role,
    statements: roleStatements,
    userId: sessionResult.user.id,
  };
}

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

  const hasBetterAuthSessionCookie = Boolean(
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token"),
  );

  if (requirement === "management") {
    if (hasBetterAuthSessionCookie) {
      const orgInfo = await resolveSessionOrganization(db, request);
      return {
        kind: "management",
        organizationId: orgInfo.organizationId,
        role: orgInfo.role,
        statements: orgInfo.statements,
      };
    }
    if (isManagementRequest(request, config)) {
      const defaultOrgId = await resolveDefaultOrganizationId(db);
      return {
        kind: "management",
        organizationId: defaultOrgId,
        role: "owner",
        statements: defaultRoleStatements.owner,
      };
    }
    throw unauthorized();
  }

  if (requirement === "publish-key") {
    const secret = bearerToken(request);
    if (!secret) throw unauthorized("A Publish Key is required");
    const verification = await getAuth().api.verifyApiKey({
      body: { key: secret, permissions: { manifest: ["write"] } },
    });
    if (!verification.valid || !verification.key) throw unauthorized("The Publish Key is invalid");
    const metadata = verification.key.metadata;
    const keyAppId =
      metadata && typeof metadata === "object" && "appId" in metadata
        ? typeof metadata.appId === "string"
          ? metadata.appId
          : undefined
        : undefined;
    if (!keyAppId) throw unauthorized("The Publish Key is not bound to an App");
    if (appId && keyAppId !== appId) throw notFound();

    const appRow = await db
      .select({ organizationId: apps.organizationId })
      .from(apps)
      .where(eq(apps.id, keyAppId))
      .get();
    if (!appRow) throw notFound("App not found");
    const organizationId = appRow.organizationId ?? (await resolveDefaultOrganizationId(db));

    const keyCreatorId = verification.key.referenceId;
    if (keyCreatorId) {
      const memberRow = await db
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.organizationId, organizationId), eq(member.userId, keyCreatorId)))
        .get();
      if (!memberRow) {
        throw forbidden("Publish Key creator is no longer a member of the organization");
      }
    }

    return { kind: "publish-key", appId: keyAppId, organizationId };
  }
  if (requirement === "client" || requirement === "session") {
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
        const appRow = await db
          .select({ organizationId: apps.organizationId })
          .from(apps)
          .where(eq(apps.id, session.appId))
          .get();
        const organizationId = appRow?.organizationId ?? (await resolveDefaultOrganizationId(db));
        return { kind: "session", appId: session.appId, sessionId: session.id, organizationId };
      }
    }

    if (hasBetterAuthSessionCookie) {
      const orgInfo = await resolveSessionOrganization(db, request);
      return {
        kind: "management",
        organizationId: orgInfo.organizationId,
        role: orgInfo.role,
        statements: orgInfo.statements,
      };
    }

    if (isManagementRequest(request, config)) {
      const defaultOrgId = await resolveDefaultOrganizationId(db);
      return {
        kind: "management",
        organizationId: defaultOrgId,
        role: "owner",
        statements: defaultRoleStatements.owner,
      };
    }
    throw unauthorized("A valid Studio Session or management authorization is required");
  }

  throw unauthorized("Unsupported authentication requirement");
}

export async function assertAppInOrganization(
  db: AppDatabase,
  appId: string,
  organizationId: string,
): Promise<void> {
  const app = await db
    .select({ organizationId: apps.organizationId })
    .from(apps)
    .where(eq(apps.id, appId))
    .get();
  if (!app || (app.organizationId && app.organizationId !== organizationId)) {
    throw notFound();
  }
}

export function assertPermission(ctx: AuthContext, resource: string, action: string): void {
  if (ctx.kind !== "management") return;
  if (hasStatement(ctx.statements, resource, action)) return;
  throw forbidden(`Permission denied: missing ${resource}:${action}`);
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
