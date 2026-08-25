import { z } from "zod";

const envSchema = z.object({
  OPENSCENE_DATABASE_URL: z.string().min(1).default("file:./data/openscene.db"),
  OPENSCENE_DATABASE_AUTH_TOKEN: z.string().optional(),
  OPENSCENE_MIGRATIONS_DIR: z.string().min(1).optional(),
  OPENSCENE_AUTH_MODE: z.enum(["disabled", "token", "proxy"]).default("disabled"),
  OPENSCENE_MANAGEMENT_TOKEN: z.string().optional(),
  OPENSCENE_TRUSTED_PROXY_HEADER: z.string().min(1).default("x-authenticated-user"),
  OPENSCENE_TRUSTED_PROXY_VALUE: z.string().optional(),
  OPENSCENE_MANAGEMENT_ORIGINS: z.string().default(""),
  OPENSCENE_APP_KEY_HEADER: z.string().min(1).default("x-openscene-app-key"),
  OPENSCENE_RUNTIME_KEY_HEADER: z.string().min(1).default("x-openscene-runtime-key"),
  OPENSCENE_RUNTIME_PUBLIC: z.enum(["true", "false"]).default("false"),
  OPENSCENE_ENCRYPTION_KEY: z.string().min(1).optional(),
  OPENSCENE_STUDIO_PUBLIC_BASE_URL: z.string().url().default("http://localhost:5173"),
  OPENSCENE_API_PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  OPENSCENE_SESSION_TTL_SECONDS: z.coerce.number().int().positive().max(86_400).default(1_800),
  OPENSCENE_UI_SESSION_TTL_SECONDS: z.coerce.number().int().positive().max(86_400).default(28_800),
  OPENSCENE_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(52_428_800),
  OPENSCENE_ALLOWED_MIME_TYPES: z
    .string()
    .default("image/jpeg,image/png,image/webp,image/gif,application/pdf"),
  OPENSCENE_AI_ENCRYPTION_KEY: z
    .string()
    .min(1)
    .default("openscene-dev-ai-encryption-key-change-in-production"),
});

export type AppConfig = {
  database: { url: string; authToken?: string; migrationsDir?: string };
  auth: {
    mode: "disabled" | "token" | "proxy";
    managementToken?: string;
    trustedProxyHeader: string;
    trustedProxyValue?: string;
    managementOrigins: string[];
    appKeyHeader: string;
    runtimeKeyHeader: string;
    runtimePublic: boolean;
  };
  encryption: { key: string };
  api: { publicBaseUrl: string };
  studio: { publicBaseUrl: string; sessionTtlSeconds: number; uiSessionTtlSeconds: number };
  ai: { encryptionKey: string };
  security: { maxUploadBytes: number; allowedMimeTypes: string[] };
};

let cachedConfig: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid OpenScene configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }
  const env = parsed.data;
  if (env.OPENSCENE_AUTH_MODE === "token" && !env.OPENSCENE_MANAGEMENT_TOKEN) {
    throw new Error("OPENSCENE_MANAGEMENT_TOKEN is required when OPENSCENE_AUTH_MODE=token");
  }
  if (env.OPENSCENE_AUTH_MODE === "proxy" && !env.OPENSCENE_TRUSTED_PROXY_VALUE) {
    throw new Error("OPENSCENE_TRUSTED_PROXY_VALUE is required when OPENSCENE_AUTH_MODE=proxy");
  }
  cachedConfig = {
    database: {
      url: env.OPENSCENE_DATABASE_URL,
      authToken: env.OPENSCENE_DATABASE_AUTH_TOKEN,
      migrationsDir: env.OPENSCENE_MIGRATIONS_DIR,
    },
    auth: {
      mode: env.OPENSCENE_AUTH_MODE,
      managementToken: env.OPENSCENE_MANAGEMENT_TOKEN,
      trustedProxyHeader: env.OPENSCENE_TRUSTED_PROXY_HEADER,
      trustedProxyValue: env.OPENSCENE_TRUSTED_PROXY_VALUE,
      managementOrigins: splitCsv(env.OPENSCENE_MANAGEMENT_ORIGINS),
      appKeyHeader: env.OPENSCENE_APP_KEY_HEADER,
      runtimeKeyHeader: env.OPENSCENE_RUNTIME_KEY_HEADER,
      runtimePublic: env.OPENSCENE_RUNTIME_PUBLIC === "true",
    },
    api: { publicBaseUrl: env.OPENSCENE_API_PUBLIC_BASE_URL },
    studio: {
      publicBaseUrl: env.OPENSCENE_STUDIO_PUBLIC_BASE_URL,
      sessionTtlSeconds: env.OPENSCENE_SESSION_TTL_SECONDS,
      uiSessionTtlSeconds: env.OPENSCENE_UI_SESSION_TTL_SECONDS,
    },
    encryption: {
      key: env.OPENSCENE_ENCRYPTION_KEY || env.OPENSCENE_AI_ENCRYPTION_KEY,
    },
    ai: {
      encryptionKey: env.OPENSCENE_ENCRYPTION_KEY || env.OPENSCENE_AI_ENCRYPTION_KEY,
    },
    security: {
      maxUploadBytes: env.OPENSCENE_MAX_UPLOAD_BYTES,
      allowedMimeTypes: splitCsv(env.OPENSCENE_ALLOWED_MIME_TYPES),
    },
  };
  return cachedConfig;
}

export function resetConfigForTests(): void {
  cachedConfig = undefined;
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
