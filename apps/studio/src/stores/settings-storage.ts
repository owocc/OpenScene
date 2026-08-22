import type { ActiveToolMode, Surface } from "@/core/editor-state";
import type { SidebarTab } from "@/components/studio/sidebar/types";
import type { BackgroundTexture } from "./canvas-settings-store";

/**
 * Persisted Studio UI settings, keyed per server (from the `server-url`
 * query parameter; "default" namespace when absent).
 */
export interface StudioSettings {
  surface?: Surface;
  locale?: string;
  tool?: ActiveToolMode;
  selectedDeviceId?: string;
  currentDeviceWidth?: number;
  currentDeviceHeight?: number;
  zoom?: number;
  panX?: number;
  panY?: number;
  rotated?: boolean;
  panel?: SidebarTab | null;
  sidebarCollapsed?: boolean;
  propsCollapsed?: boolean;
  showBackgroundPattern?: boolean;
  backgroundTexture?: BackgroundTexture;
}

const STORAGE_PREFIX = "openscene:studio:settings";

function shortHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** Stable short namespace suffix for a server URL. */
export function namespaceForServer(server: string | null | undefined): string {
  if (!server) return "default";
  return `server-${shortHash(server)}`;
}

/**
 * Settings namespace: server-scoped, further split per session so different
 * sessions (same server) keep separate caches. Falls back to the server
 * namespace when no session id is present.
 */
export function settingsNamespaceFor(
  server: string | null | undefined,
  sessionId: string | null | undefined,
): string {
  const serverNs = namespaceForServer(server);
  return sessionId ? `${serverNs}:session-${shortHash(sessionId)}` : serverNs;
}

/** Server-only namespace (theme scope, user-level preference). */
export function getServerNamespace(): string {
  if (typeof window === "undefined") return "default";
  const params = new URLSearchParams(window.location.search);
  return namespaceForServer(params.get("server-url") ?? params.get("serverUrl"));
}

/** Namespace of the current page: server + sessionId query parameters. */
export function getSettingsNamespace(): string {
  if (typeof window === "undefined") return "default";
  const params = new URLSearchParams(window.location.search);
  return settingsNamespaceFor(
    params.get("server-url") ?? params.get("serverUrl"),
    params.get("sessionId"),
  );
}

function settingsKey(): string {
  return `${STORAGE_PREFIX}:${getSettingsNamespace()}`;
}

/** Theme storage key scoped to the current server namespace. */
export function getThemeStorageKey(): string {
  return `${STORAGE_PREFIX}:theme:${getServerNamespace()}`;
}

export function loadServerSettings(): StudioSettings {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(settingsKey());
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as StudioSettings) : {};
  } catch {
    return {};
  }
}

export function saveServerSettings(patch: StudioSettings): void {
  if (typeof window === "undefined") return;
  try {
    const next = { ...loadServerSettings(), ...patch };
    window.localStorage.setItem(settingsKey(), JSON.stringify(next));
  } catch {
    // storage unavailable (private mode / quota): persistence is best-effort
  }
}
