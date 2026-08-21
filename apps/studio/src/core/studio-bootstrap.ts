import { createOpenSceneClient, isApiProblem } from "@openscene/api-client";

import { normalizeAppDocument, type AppDocument } from "./document";
import { createLocalTestBootstrap, LOCAL_TEST_SESSION_ID } from "./local-test-session";
import type { AppMaterialManifest } from "./material-manifest";
import { useQueryStore } from "@/stores/query-store";

export interface StudioBootstrap {
  session: { id: string; expiresAt: string };
  app: { id: string; key: string; name: string };
  resource: { id: string; kind: "page" | "template"; title: string; documentId: string };
  draft: { revision: number; document: AppDocument };
  manifest: AppMaterialManifest | null;
  preview: { url: string; allowedOrigin: string; profileId: string };
  capabilities: {
    saveDraft: boolean;
    createVersion: boolean;
    publish: boolean;
    uploadAsset: boolean;
  };
  returnUrl: string;
}

export type StudioBootstrapState =
  | { status: "loading" }
  | { status: "standalone" }
  | { status: "missing-server-url" }
  | { status: "ready"; value: StudioBootstrap }
  | { status: "error"; message: string };

export async function loadStudioBootstrap(signal?: AbortSignal): Promise<StudioBootstrapState> {
  const query = useQueryStore.getState();
  const sessionId = query.sessionId;
  const token = query.token;
  const serverUrl = query.serverUrl;

  // 1. Local test session (development only)
  if (sessionId === LOCAL_TEST_SESSION_ID) {
    if (!import.meta.env.DEV) {
      return { status: "error", message: "local-test session is only available in development" };
    }

    const value = createLocalTestBootstrap();
    return { status: "ready", value };
  }

  // 2. Standalone: Missing sessionId or token
  if (!sessionId || !token) {
    return { status: "standalone" };
  }

  // 3. Strict Server URL requirement: App does NOT store baseUrl, must be passed via query parameter
  if (!serverUrl) {
    return { status: "missing-server-url" };
  }

  try {
    const client = createOpenSceneClient({
      baseUrl: serverUrl.replace(/\/$/, ""),
      headers: { "x-openscene-session-token": token },
      signal,
    });

    const { data, error, response } = await client.GET(
      "/api/v1/studio-sessions/{sessionId}/bootstrap",
      {
        params: {
          path: { sessionId },
        },
        signal,
      },
    );

    if (error) {
      const message = isApiProblem(error) ? error.detail : `Bootstrap failed (${response.status})`;
      return { status: "error", message };
    }

    if (!data || typeof data !== "object" || !("draft" in data) || !data.draft) {
      return { status: "error", message: "Studio bootstrap payload is invalid" };
    }

    const value = data as unknown as StudioBootstrap;
    value.draft = {
      revision: value.draft.revision,
      document: normalizeAppDocument(value.draft.document),
    };

    if (!value.manifest && !value.preview?.url) {
      return { status: "error", message: "Target App did not provide a preview profile" };
    }

    return { status: "ready", value };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to load Studio session",
    };
  }
}
