import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AppManifestSchema, type AppManifest } from "@openscene/protocol";

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

      let response: Response;
      try {
        response = await fetch(
          `${adminUrl.replace(/\/+$/u, "")}/api/v1/apps/${encodeURIComponent(appId)}/manifest/push`,
          {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
              "x-openscene-app-key": appKey,
            },
            body: JSON.stringify(parsedManifest),
          },
        );
      } catch {
        throw new Error(
          "OpenScene manifest push failed because the Admin server could not be reached",
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
