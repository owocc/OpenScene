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

/** Stable short namespace suffix for a server URL. */
export function namespaceForServer(server: string | null | undefined): string {
  if (!server) return "default";
  let hash = 0;
  for (let i = 0; i < server.length; i += 1) {
    hash = (hash * 31 + server.charCodeAt(i)) | 0;
  }
  return `server-${(hash >>> 0).toString(36)}`;
}

/** Namespace of the current page: derived from the `server-url` query parameter. */
export function getSettingsNamespace(): string {
  if (typeof window === "undefined") return "default";
  const params = new URLSearchParams(window.location.search);
  return namespaceForServer(params.get("server-url") ?? params.get("serverUrl"));
}

function settingsKey(): string {
  return `${STORAGE_PREFIX}:${getSettingsNamespace()}`;
}

/** Theme storage key scoped to the current server namespace. */
export function getThemeStorageKey(): string {
  return `${STORAGE_PREFIX}:theme:${getSettingsNamespace()}`;
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
