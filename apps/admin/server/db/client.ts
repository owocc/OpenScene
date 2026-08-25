import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { sql } from "drizzle-orm";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig, type AppConfig } from "../config/env";
import { schema } from "./schema";

export type AppDatabase = LibSQLDatabase<typeof schema>;
export type DatabaseRuntime = { db: AppDatabase; client: Client };

let runtimePromise: Promise<DatabaseRuntime> | undefined;

export function createDatabaseRuntime(config: AppConfig = getConfig()): DatabaseRuntime {
  const client = createClient({
    url: normalizeDatabaseUrl(config.database.url),
    authToken: config.database.authToken,
  });
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function initializeDatabase(
  config: AppConfig = getConfig(),
): Promise<DatabaseRuntime> {
  if (!runtimePromise) {
    runtimePromise = initialize(config);
  }
  return runtimePromise;
}

export async function resetDatabaseForTests(): Promise<void> {
  runtimePromise = undefined;
}

export async function checkDatabaseHealth(
  runtime: DatabaseRuntime,
): Promise<{ status: "up" | "down"; detail?: string }> {
  try {
    await runtime.db.run(sql`select 1`);
    return { status: "up" };
  } catch {
    return { status: "down", detail: "Database query failed" };
  }
}

async function initialize(config: AppConfig): Promise<DatabaseRuntime> {
  const runtime = createDatabaseRuntime(config);
  const migrationsFolder = resolveMigrationsFolder(config);
  await migrate(runtime.db, { migrationsFolder });
  return runtime;
}

function resolveMigrationsFolder(config: AppConfig): string {
  if (config.database.migrationsDir) return config.database.migrationsDir;
  const cwdFolder = path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle");
  if (hasMigrationJournal(cwdFolder)) return cwdFolder;
  const packageFolder = path.resolve(
    /*turbopackIgnore: true*/ path.dirname(fileURLToPath(import.meta.url)),
    "../../drizzle",
  );
  if (hasMigrationJournal(packageFolder)) return packageFolder;
  throw new Error("OpenScene migrations directory is not configured or available");
}

function hasMigrationJournal(folder: string): boolean {
  return existsSync(path.join(folder, "meta", "_journal.json"));
}

function normalizeDatabaseUrl(url: string): string {
  if (!url.startsWith("file:")) return url;
  const filePath = url.slice("file:".length);
  if (!filePath || filePath === ":memory:") return url;
  const absolutePath = filePath.startsWith("/")
    ? filePath
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), filePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  return `file:${absolutePath}`;
}
