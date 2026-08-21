import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "turso",
  schema: "./server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.OPENSCENE_DATABASE_URL ?? "file:./data/openscene.db",
    authToken: process.env.OPENSCENE_DATABASE_AUTH_TOKEN,
  },
  strict: true,
  verbose: true,
});
