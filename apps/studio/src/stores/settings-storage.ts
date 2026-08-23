import type { ActiveToolMode, Surface } from "@/core/editor-state";
import type { SidebarTab } from "@/components/studio/sidebar/types";
import type { BackgroundTexture } from "./canvas-settings-store";

/**
 * User-level preferences shared across the whole application: never scoped
 * per app, per server, or per session. Currently the editor language.
 */
export interface StudioPreferences {
  locale?: string;
}

/**
 * Per-app view state: editor surface, canvas viewport, sidebar/panel layout,
 * and canvas texture. Persisted per app id (known only after bootstrap), so
 * editing different apps keeps independent workspaces while the same app
 * restores its view across sessions.
 */
export interface StudioViewSettings {
  surface?: Surface;
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
  sidebarWidth?: number;
  propsCollapsed?: boolean;
  propertiesWidth?: number;
  showBackgroundPattern?: boolean;
  backgroundTexture?: BackgroundTexture;
}

const PREFERENCES_KEY = "openscene:studio:preferences";
const VIEW_PREFIX = "openscene:studio:view";

function viewKeyFor(appId: string): string {
  return `${VIEW_PREFIX}:${appId}`;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode / quota): persistence is best-effort
  }
}

/** Global, app-wide preferences (language, …). */
export function loadPreferences(): StudioPreferences {
  if (typeof window === "undefined") return {};
  return readJson<StudioPreferences>(PREFERENCES_KEY) ?? {};
}

export function savePreferences(patch: StudioPreferences): void {
  if (typeof window === "undefined") return;
  writeJson(PREFERENCES_KEY, { ...loadPreferences(), ...patch });
}

/** View state for a specific app, keyed by its app id. */
export function loadAppViewSettings(appId: string): StudioViewSettings {
  if (typeof window === "undefined") return {};
  return readJson<StudioViewSettings>(viewKeyFor(appId)) ?? {};
}

export function saveAppViewSettings(appId: string, patch: StudioViewSettings): void {
  if (typeof window === "undefined") return;
  writeJson(viewKeyFor(appId), { ...loadAppViewSettings(appId), ...patch });
}

/** Theme storage key scoped to the current server namespace. */
export function getThemeStorageKey(): string {
  if (typeof window === "undefined") return "openscene:studio:settings:theme:default";
  const params = new URLSearchParams(window.location.search);
  const server = params.get("server-url") ?? params.get("serverUrl");
  if (!server) return "openscene:studio:settings:theme:default";
  let hash = 0;
  for (let i = 0; i < server.length; i += 1) {
    hash = (hash * 31 + server.charCodeAt(i)) | 0;
  }
  return `openscene:studio:settings:theme:server-${(hash >>> 0).toString(36)}`;
}
