import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { createDatabaseRuntime } from "../server/db/client.ts";
import * as schema from "../server/db/schema/index.ts";
import { ac, defaultRoles } from "./permissions.ts";
const socialProviders: Record<
  string,
  { clientId: string; clientSecret: string; [key: string]: unknown }
> = {};

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  };
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  socialProviders.discord = {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
  };
}

function createAuth() {
  const { db } = createDatabaseRuntime();
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      apiKey({
        requireName: true,
        defaultPrefix: "osc_publish_",
        enableMetadata: true,
        permissions: {
          defaultPermissions: { manifest: ["write"] },
        },
      }),
      organization({
        allowUserToCreateOrganization: true,
        ac,
        roles: defaultRoles,
        dynamicAccessControl: { enabled: true },
        creatorRole: "owner",
      }),
    ],
    socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
  });
}

let authDatabaseUrl = process.env.OPENSCENE_DATABASE_URL;
let authInstance = createAuth();

export function getAuth() {
  const currentDatabaseUrl = process.env.OPENSCENE_DATABASE_URL;
  if (currentDatabaseUrl !== authDatabaseUrl) {
    authDatabaseUrl = currentDatabaseUrl;
    authInstance = createAuth();
  }
  return authInstance;
}

/** Stable production instance; tests and multi-database processes use getAuth(). */
export const auth = authInstance;
export type Session = typeof auth.$Infer.Session;
