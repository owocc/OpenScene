import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AppManifestSchema, type AppManifest } from "@openscene/protocol";
import { ProxyAgent, fetch as undiciFetch } from "undici";

export interface OpenSceneManifestPluginOptions {
  manifest: AppManifest;
}

interface ViteResolvedConfig {
  command: string;
  mode: string;
  envDir: string;
}

interface VitePlugin {
  name: string;
  apply?: "build" | "serve" | ((config: ViteResolvedConfig) => boolean);
  configResolved?: (config: ViteResolvedConfig) => void;
  closeBundle?: () => void | Promise<void>;
}

function readEnvFile(path: string): Record<string, string> {
  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const values: Record<string, string> = {};
  for (const line of source.split(/\r?\n/u)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u.exec(line);
    if (!match) continue;
    const raw = match[2] ?? "";
    values[match[1]] = raw.replace(/^(['"])(.*)\1$/u, "$2");
  }
  return values;
}

function loadEnv(mode: string, envDir: string, _prefix = ""): Record<string, string> {
  const values: Record<string, string> = {
    ...readEnvFile(join(envDir, ".env")),
    ...readEnvFile(join(envDir, ".env.local")),
    ...readEnvFile(join(envDir, `.env.${mode}`)),
    ...readEnvFile(join(envDir, `.env.${mode}.local`)),
  };
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) values[key] = value;
  }
  return values;
}

function configurationError(): Error {
  return new Error(
    "OpenScene manifest push requires OPENSCENE_ADMIN_URL, OPENSCENE_APP_ID, and OPENSCENE_APP_KEY",
  );
}

async function responseError(response: Response): Promise<Error> {
  let detail = "";
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      !Array.isArray(payload) &&
      "detail" in payload &&
      typeof payload.detail === "string"
    ) {
      detail = `: ${payload.detail}`;
    }
  } catch {
    // Use the HTTP status when an unsuccessful response is not a problem document.
  }
  return new Error(`OpenScene manifest push failed (HTTP ${response.status})${detail}`);
}

function getFetchDispatcher(env?: Record<string, string>): unknown {
  const proxy =
    env?.https_proxy ||
    env?.HTTPS_PROXY ||
    env?.http_proxy ||
    env?.HTTP_PROXY ||
    env?.all_proxy ||
    env?.ALL_PROXY ||
    process.env.https_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.HTTP_PROXY ||
    process.env.all_proxy ||
    process.env.ALL_PROXY;
  if (!proxy) return undefined;
  try {
    return new ProxyAgent(proxy);
  } catch {
    return undefined;
  }
}

/**
 * Pushes a build manifest once after a successful Vite build. The app key is
 * sent only as a request header and is never injected into generated assets.
 */
export function openSceneManifestPlugin(options: OpenSceneManifestPluginOptions): VitePlugin {
  const manifest = options.manifest;
  let config: ViteResolvedConfig | null = null;
  let pushed = false;

  return {
    name: "openscene-manifest-push",
    apply: "build",
    configResolved(resolved) {
      config = resolved;
    },
    async closeBundle() {
      if (pushed || !config || config.command !== "build") return;
      pushed = true;
      const env = loadEnv(config.mode, config.envDir, "");
      const adminUrl = env.OPENSCENE_ADMIN_URL?.trim() ?? "";
      const appId = env.OPENSCENE_APP_ID?.trim() ?? "";
      const appKey = env.OPENSCENE_APP_KEY?.trim() ?? "";
      if (!adminUrl && !appId && !appKey) return;
      if (!adminUrl || !appId || !appKey) throw configurationError();
      const parsedManifest = AppManifestSchema.parse(manifest);

      const dispatcher = getFetchDispatcher(env);
      const fetchFn = dispatcher ? undiciFetch : globalThis.fetch;
      let response: Response;
      try {
        response = await (fetchFn as typeof fetch)(
          `${adminUrl.replace(/\/+$/u, "")}/api/v1/apps/${encodeURIComponent(appId)}/manifest/push`,
          {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
              "x-openscene-app-key": appKey,
            },
            body: JSON.stringify(parsedManifest),
            ...(dispatcher ? { dispatcher } : {}),
          } as RequestInit,
        );
      } catch (error) {
        const cause = (error as { cause?: unknown })?.cause;
        const causeMessage =
          cause instanceof Error
            ? cause.message
            : typeof cause === "string"
              ? cause
              : cause && typeof cause === "object" && "message" in cause
                ? String((cause as { message: unknown }).message)
                : "";
        const baseMessage = error instanceof Error ? error.message : String(error);
        const detail = causeMessage ? `${baseMessage} (${causeMessage})` : baseMessage;
        const target = `${adminUrl.replace(/\/+$/u, "")}/api/v1/apps/${encodeURIComponent(appId)}/manifest/push`;
        throw new Error(
          `OpenScene manifest push failed because the Admin server could not be reached at ${target}: ${detail}`,
        );
      }
      if (!response.ok) throw await responseError(response);
      try {
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== "object" || Array.isArray(payload))
          throw new Error("invalid response");
      } catch {
        throw new Error("OpenScene manifest push returned an invalid response");
      }
    },
  };
}
