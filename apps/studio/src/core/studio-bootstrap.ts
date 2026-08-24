import { createOpenSceneClient, isApiProblem } from "@openscene/api-client";
import type { AppType } from "@openscene/constants";
import {
  AppManifestSchema,
  SceneDocumentSchema,
  type AppManifest,
  type SceneDocument,
} from "@openscene/protocol";

import { createLocalTestBootstrap, LOCAL_TEST_SESSION_ID } from "./local-test-session";
import { useQueryStore } from "@/stores/query-store";

export interface AppPromptInfo {
  id: string;
  key: string;
  name: string;
  description?: string;
  isDefault: boolean;
  enabled: boolean;
}

export interface StudioBootstrap {
  session: { id: string; expiresAt: string };
  app: { id: string; key: string; name: string; type: AppType };
  resource: {
    id: string;
    kind: "page" | "template";
    title: string;
    documentId: string;
    defaultPromptId?: string | null;
  };
  draft: { revision: number; document: SceneDocument };
  manifest: AppManifest | null;
  preview: { url: string; allowedOrigin: string; profileId: string };
  capabilities: {
    saveDraft: boolean;
    createVersion: boolean;
    publish: boolean;
    uploadAsset: boolean;
  };
  returnUrl: string;
  prompts?: AppPromptInfo[];
  chatSessions?: unknown[];
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
  const previewUrl = query.previewUrl;

  if (sessionId === LOCAL_TEST_SESSION_ID) {
    if (!import.meta.env.DEV) {
      return { status: "error", message: "local-test session is only available in development" };
    }
    return { status: "ready", value: createLocalTestBootstrap(previewUrl ?? undefined) };
  }

  if (!sessionId || !token) return { status: "standalone" };
  if (!serverUrl) return { status: "missing-server-url" };

  try {
    const client = createOpenSceneClient({
      baseUrl: serverUrl.replace(/\/$/, ""),
      headers: { "x-openscene-session-token": token },
      signal,
    });
    const { data, error, response } = await client.GET(
      "/api/v1/studio-sessions/{sessionId}/bootstrap",
      { params: { path: { sessionId } }, signal },
    );
    if (error) {
      const message = isApiProblem(error) ? error.detail : `Bootstrap failed (${response.status})`;
      return { status: "error", message };
    }
    if (!data || typeof data !== "object" || !("draft" in data) || !data.draft) {
      return { status: "error", message: "Studio bootstrap payload is invalid" };
    }

    const value = data as unknown as StudioBootstrap;
    const parsed = SceneDocumentSchema.safeParse(value.draft.document);
    if (!parsed.success) {
      return {
        status: "error",
        message: "Studio draft document does not match the canonical protocol",
      };
    }
    value.draft = { revision: value.draft.revision, document: parsed.data };
    if (value.manifest !== null) {
      const manifest = AppManifestSchema.safeParse(value.manifest);
      if (!manifest.success || manifest.data.app.type !== value.app.type) {
        return {
          status: "error",
          message: "Studio manifest does not match the canonical App type",
        };
      }
      value.manifest = manifest.data;
    }
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
