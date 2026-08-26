import { apiKeyClient } from "@better-auth/api-key/client";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, defaultRoles } from "./permissions.ts";

export const authClient = createAuthClient({
  plugins: [
    apiKeyClient(),
    organizationClient({
      ac,
      roles: defaultRoles,
      dynamicAccessControl: { enabled: true },
    }),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  useActiveOrganization,
  useListOrganizations,
  useActiveMember,
} = authClient;
