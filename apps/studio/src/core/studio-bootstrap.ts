import { normalizeAppDocument, type AppDocument } from "./document";
import { createLocalTestBootstrap, LOCAL_TEST_SESSION_ID } from "./local-test-session";
import type { AppMaterialManifest } from "./material-manifest";

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
  | { status: "ready"; value: StudioBootstrap }
  | { status: "error"; message: string };

function apiOrigin() {
  const configured = import.meta.env.VITE_OPENSCENE_ADMIN_API_BASE_URL as string | undefined;
  return (configured || window.location.origin).replace(/\/$/, "");
}

function sessionCredentials() {
  const sessionId = new URLSearchParams(window.location.search).get("sessionId");
  const token = window.location.hash.startsWith("#token=")
    ? decodeURIComponent(window.location.hash.slice("#token=".length))
    : undefined;
  return { sessionId, token };
}

function isBootstrap(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function loadStudioBootstrap(signal?: AbortSignal): Promise<StudioBootstrapState> {
  const { sessionId, token } = sessionCredentials();
  if (sessionId === LOCAL_TEST_SESSION_ID) {
    if (!import.meta.env.DEV) {
      return { status: "error", message: "local-test session is only available in development" };
    }

    const value = createLocalTestBootstrap();
    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${window.location.search}`,
    );
    return { status: "ready", value };
  }
  if (!sessionId || !token) return { status: "standalone" };

  try {
    const response = await fetch(
      `${apiOrigin()}/api/v1/studio-sessions/${encodeURIComponent(sessionId)}/bootstrap`,
      {
        headers: { "x-openscene-session-token": token },
        credentials: "include",
        signal,
      },
    );
    const payload: unknown = await response.json();
    if (!response.ok) {
      const detail =
        isBootstrap(payload) && typeof payload.detail === "string"
          ? payload.detail
          : `Bootstrap failed (${response.status})`;
      return { status: "error", message: detail };
    }
    if (!isBootstrap(payload) || !isBootstrap(payload.draft)) {
      return { status: "error", message: "Studio bootstrap payload is invalid" };
    }

    const value = payload as unknown as StudioBootstrap;
    value.draft = {
      revision: value.draft.revision,
      document: normalizeAppDocument(value.draft.document),
    };
    if (!value.manifest && !value.preview?.url) {
      return { status: "error", message: "Target App did not provide a preview profile" };
    }
    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${window.location.search}`,
    );
    return { status: "ready", value };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to load Studio session",
    };
  }
}
