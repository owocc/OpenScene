import { createAccessControl } from "better-auth/plugins/access";

export const statements = {
  organization: ["update", "delete"],
  member: ["create", "read", "update", "delete"],
  invitation: ["create", "read", "cancel"],
  app: ["create", "read", "update", "delete"],
  ai: ["manage"],
  ac: ["create", "read", "update", "delete"],
} as const;

export type StatementResource = keyof typeof statements;

export const defaultRoleStatements: Record<string, Record<string, readonly string[]>> = {
  owner: {
    organization: ["update", "delete"],
    member: ["create", "read", "update", "delete"],
    invitation: ["create", "read", "cancel"],
    app: ["create", "read", "update", "delete"],
    ai: ["manage"],
    ac: ["create", "read", "update", "delete"],
  },
  admin: {
    organization: ["update"],
    member: ["create", "read", "update", "delete"],
    invitation: ["create", "read", "cancel"],
    app: ["create", "read", "update", "delete"],
    ai: ["manage"],
    ac: ["create", "read", "update", "delete"],
  },
  member: {
    member: ["read"],
    app: ["read"],
  },
};

export const ac = createAccessControl(statements);

export const defaultRoles = {
  owner: ac.newRole(defaultRoleStatements.owner),
  admin: ac.newRole(defaultRoleStatements.admin),
  member: ac.newRole(defaultRoleStatements.member),
};

export function hasStatement(
  roleStatements:
    | { statements?: Record<string, readonly string[]> }
    | Record<string, readonly string[]>
    | undefined
    | null,
  resource: string,
  action: string,
): boolean {
  if (!roleStatements) return false;
  const raw =
    "statements" in roleStatements && roleStatements.statements
      ? roleStatements.statements
      : (roleStatements as Record<string, readonly string[]>);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const actions = (raw as Record<string, readonly string[]>)[resource];
  if (!actions || !Array.isArray(actions)) return false;
  return actions.includes(action);
}
