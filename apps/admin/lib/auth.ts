import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sql } from "drizzle-orm";
import { createDatabaseRuntime } from "../server/db/client.ts";
import * as schema from "../server/db/schema/index.ts";

const { db } = createDatabaseRuntime();

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

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Allow only the very first admin user creation (initial setup)
          const userCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.user)
            .get();
          if ((userCount?.count ?? 0) > 0) {
            throw new Error("Public registration is disabled. OpenScene is already initialized.");
          }
          return { data: user };
        },
      },
    },
  },
  socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
});

export type Session = typeof auth.$Infer.Session;
