import { create } from "zustand";

import type { ActiveToolMode, Surface } from "@/core/editor-state";
import type { SidebarTab } from "@/components/studio/sidebar/types";
import { loadServerSettings, saveServerSettings } from "./settings-storage";

export interface StudioQueryParams {
  serverUrl: string | null;
  sessionId: string | null;
  token?: string | null;
  previewUrl: string | null;
  surface: Surface;
  nodeId: string | null;
  locale: string | null;
  tool: ActiveToolMode;
  selectedDeviceId: string | null;
  currentDeviceWidth: number | null;
  currentDeviceHeight: number | null;
  zoom: number | null;
  panX: number | null;
  panY: number | null;
  rotated: boolean;
  panel: SidebarTab | null;
  sidebarCollapsed: boolean;
  propsCollapsed: boolean;
}

export interface QueryStoreState extends StudioQueryParams {
  // Sync Actions
  syncFromUrl: () => void;
  setQuery: (patch: Partial<StudioQueryParams>, options?: { push?: boolean }) => void;

  // Granular Actions
  setServerUrl: (serverUrl: string | null) => void;
  setSessionId: (sessionId: string | null, token?: string | null) => void;
  setPreviewUrl: (previewUrl: string | null) => void;
  setSurface: (surface: Surface) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setLocale: (locale: string) => void;
  setTool: (tool: ActiveToolMode) => void;
  setZoom: (zoom: number) => void;
  setPan: (panX: number, panY: number) => void;
  setRotated: (rotated: boolean) => void;
  setPanel: (panel: SidebarTab | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setPropsCollapsed: (collapsed: boolean) => void;
  resetViewportParams: () => void;
}

export const DEFAULT_QUERY_PARAMS: StudioQueryParams = {
  serverUrl: null,
  sessionId: null,
  token: null,
  previewUrl: null,
  surface: "visual",
  nodeId: null,
  locale: null,
  tool: "select",
  selectedDeviceId: null,
  currentDeviceWidth: null,
  currentDeviceHeight: null,
  zoom: null,
  panX: null,
  panY: null,
  rotated: false,
  panel: "file",
  sidebarCollapsed: false,
  propsCollapsed: false,
};

export function parseQueryParams(search: string, hash = ""): StudioQueryParams {
  const searchParams = new URLSearchParams(search);

  // 1. Server URL (Explicit backend endpoint from query, e.g. ?server-url=http://localhost:3000)
  const serverUrl = searchParams.get("server-url") || searchParams.get("serverUrl") || null;

  // 2. Session ID
  const sessionId = searchParams.get("sessionId") || null;

  // 3. Token (from hash #token=... or query ?token=...)
  let token: string | null = null;
  if (hash.startsWith("#token=")) {
    token = decodeURIComponent(hash.slice("#token=".length));
  } else if (searchParams.has("token")) {
    token = searchParams.get("token");
  }
  const previewUrl = searchParams.get("preview-url") || searchParams.get("previewUrl") || null;

  // 4. Surface Mode
  const surfaceRaw = searchParams.get("surface");
  const surface: Surface =
    surfaceRaw === "visual" ||
    surfaceRaw === "text" ||
    surfaceRaw === "developer" ||
    surfaceRaw === "preview"
      ? surfaceRaw
      : "visual";

  // 5. Node selection (supports ?nodeId=... or ?selectedId=...)
  const nodeId = searchParams.get("nodeId") || searchParams.get("selectedId") || null;

  // 6. Locale
  const locale = searchParams.get("locale") || null;

  // 7. Active Canvas Tool
  const toolRaw = searchParams.get("tool");
  const tool: ActiveToolMode =
    toolRaw === "interact" || toolRaw === "hand" || toolRaw === "select" ? toolRaw : "select";

  // 8. Viewport Zoom & Pan & Rotation
  const zoomRaw = searchParams.get("zoom");
  const zoom = zoomRaw && !Number.isNaN(Number(zoomRaw)) ? Number(zoomRaw) : null;

  const panXRaw = searchParams.get("panX");
  const panX = panXRaw && !Number.isNaN(Number(panXRaw)) ? Number(panXRaw) : null;

  const panYRaw = searchParams.get("panY");
  const panY = panYRaw && !Number.isNaN(Number(panYRaw)) ? Number(panYRaw) : null;

  const rotated = searchParams.get("rotated") === "true";

  // 9. Sidebar & Panels
  const panelRaw = searchParams.get("panel") || searchParams.get("tab");
  const panel: SidebarTab | null =
    panelRaw === "agents" ||
    panelRaw === "assets" ||
    panelRaw === "tools" ||
    panelRaw === "variables" ||
    panelRaw === "file"
      ? panelRaw
      : "file";

  const sidebarCollapsed = searchParams.get("sidebarCollapsed") === "true";
  const propsCollapsed = searchParams.get("propsCollapsed") === "true";

  return {
    serverUrl,
    sessionId,
    token,
    previewUrl,
    surface,
    nodeId,
    locale,
    tool,
    selectedDeviceId: null,
    currentDeviceWidth: null,
    currentDeviceHeight: null,
    zoom,
    panX,
    panY,
    rotated,
    panel,
    sidebarCollapsed,
    propsCollapsed,
  };
}

export function formatQueryParams(params: StudioQueryParams): { search: string; hash: string } {
  const searchParams = new URLSearchParams();

  // Explicit Server URL
  if (params.serverUrl) searchParams.set("server-url", params.serverUrl);

  // Session ID
  if (params.sessionId) searchParams.set("sessionId", params.sessionId);

  if (params.previewUrl) searchParams.set("preview-url", params.previewUrl);
  // Surface (omit if default "visual")
  if (params.surface && params.surface !== "visual") searchParams.set("surface", params.surface);

  // Node Selection
  if (params.nodeId) searchParams.set("nodeId", params.nodeId);
  // Locale
  if (params.locale) searchParams.set("locale", params.locale);

  // Note: tool / zoom / panX / panY are session view state and are NOT
  // written to the URL — they persist per session in local storage.

  if (params.rotated) searchParams.set("rotated", "true");

  // Sidebar & Panels
  if (params.panel && params.panel !== "file") searchParams.set("panel", params.panel);
  if (params.sidebarCollapsed) searchParams.set("sidebarCollapsed", "true");
  if (params.propsCollapsed) searchParams.set("propsCollapsed", "true");

  const queryString = searchParams.toString();
  const search = queryString ? `?${queryString}` : "";
  const hash = params.token ? `#token=${encodeURIComponent(params.token)}` : "";

  return { search, hash };
}

function parseQueryFromUrl(): StudioQueryParams {
  if (typeof window === "undefined") return { ...DEFAULT_QUERY_PARAMS };
  return parseQueryParams(window.location.search, window.location.hash);
}

/**
 * Initial params: per-server persisted settings as the base; launch
 * credentials always come from the URL; explicitly present URL params
 * override persisted values (absent params fall back to persistence).
 */
function initialQueryParams(): StudioQueryParams {
  const url = parseQueryFromUrl();
  if (typeof window === "undefined") return url;
  const persisted = loadServerSettings();
  const merged: StudioQueryParams = { ...DEFAULT_QUERY_PARAMS, ...persisted };
  merged.serverUrl = url.serverUrl;
  merged.sessionId = url.sessionId;
  merged.token = url.token;
  merged.previewUrl = url.previewUrl;
  const present = new Set(new URLSearchParams(window.location.search).keys());
  const overrides: Record<string, unknown> = {};
  for (const key of Object.keys(url)) {
    if (present.has(key)) overrides[key] = url[key as keyof StudioQueryParams];
  }
  return { ...merged, ...(overrides as Partial<StudioQueryParams>) };
}

function writeQueryToUrl(params: StudioQueryParams, push = false) {
  if (typeof window === "undefined") return;

  const { search, hash } = formatQueryParams(params);
  const nextHash = hash || (params.token ? "" : window.location.hash);
  const nextUrl = `${window.location.pathname}${search}${nextHash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    if (push) {
      window.history.pushState({}, "", nextUrl);
    } else {
      window.history.replaceState({}, "", nextUrl);
    }
  }
}

export const useQueryStore = create<QueryStoreState>()((set, get) => {
  // Listen for browser Back/Forward (popstate) and hashchange
  if (typeof window !== "undefined") {
    const handlePopState = () => {
      const next = parseQueryFromUrl();
      set(next);
    };
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("hashchange", handlePopState);
  }

  const initial = initialQueryParams();

  return {
    ...initial,

    syncFromUrl: () => {
      const next = parseQueryFromUrl();
      set(next);
    },

    setQuery: (patch, options) => {
      const current = get();
      const updated: StudioQueryParams = {
        serverUrl: patch.serverUrl !== undefined ? patch.serverUrl : current.serverUrl,
        sessionId: patch.sessionId !== undefined ? patch.sessionId : current.sessionId,
        token: patch.token !== undefined ? patch.token : current.token,
        previewUrl: patch.previewUrl !== undefined ? patch.previewUrl : current.previewUrl,
        surface: patch.surface !== undefined ? patch.surface : current.surface,
        nodeId: patch.nodeId !== undefined ? patch.nodeId : current.nodeId,
        locale: patch.locale !== undefined ? patch.locale : current.locale,
        tool: patch.tool !== undefined ? patch.tool : current.tool,
        selectedDeviceId:
          patch.selectedDeviceId !== undefined ? patch.selectedDeviceId : current.selectedDeviceId,
        currentDeviceWidth:
          patch.currentDeviceWidth !== undefined
            ? patch.currentDeviceWidth
            : current.currentDeviceWidth,
        currentDeviceHeight:
          patch.currentDeviceHeight !== undefined
            ? patch.currentDeviceHeight
            : current.currentDeviceHeight,
        zoom: patch.zoom !== undefined ? patch.zoom : current.zoom,
        panX: patch.panX !== undefined ? patch.panX : current.panX,
        panY: patch.panY !== undefined ? patch.panY : current.panY,
        rotated: patch.rotated !== undefined ? patch.rotated : current.rotated,
        panel: patch.panel !== undefined ? patch.panel : current.panel,
        sidebarCollapsed:
          patch.sidebarCollapsed !== undefined ? patch.sidebarCollapsed : current.sidebarCollapsed,
        propsCollapsed:
          patch.propsCollapsed !== undefined ? patch.propsCollapsed : current.propsCollapsed,
      };

      set(updated);
      writeQueryToUrl(updated, options?.push ?? false);
      saveServerSettings({
        surface: updated.surface,
        locale: updated.locale ?? undefined,
        tool: updated.tool,
        selectedDeviceId: updated.selectedDeviceId ?? undefined,
        currentDeviceWidth: updated.currentDeviceWidth ?? undefined,
        currentDeviceHeight: updated.currentDeviceHeight ?? undefined,
        zoom: updated.zoom ?? undefined,
        panX: updated.panX ?? undefined,
        panY: updated.panY ?? undefined,
        rotated: updated.rotated,
        panel: updated.panel,
        sidebarCollapsed: updated.sidebarCollapsed,
        propsCollapsed: updated.propsCollapsed,
      });
    },

    setServerUrl: (serverUrl) => {
      get().setQuery({ serverUrl }, { push: false });
    },

    setSessionId: (sessionId, token) => {
      get().setQuery({ sessionId, ...(token !== undefined ? { token } : {}) }, { push: true });
    },
    setPreviewUrl: (previewUrl) => {
      get().setQuery({ previewUrl }, { push: false });
    },

    setSurface: (surface) => {
      get().setQuery({ surface }, { push: false });
    },

    setSelectedNodeId: (nodeId) => {
      get().setQuery({ nodeId }, { push: false });
    },

    setLocale: (locale) => {
      get().setQuery({ locale }, { push: false });
    },

    setTool: (tool) => {
      get().setQuery({ tool }, { push: false });
    },

    setZoom: (zoom) => {
      get().setQuery({ zoom }, { push: false });
    },

    setPan: (panX, panY) => {
      get().setQuery({ panX, panY }, { push: false });
    },

    setRotated: (rotated) => {
      get().setQuery({ rotated }, { push: false });
    },

    setPanel: (panel) => {
      get().setQuery({ panel }, { push: false });
    },

    setSidebarCollapsed: (sidebarCollapsed) => {
      get().setQuery({ sidebarCollapsed }, { push: false });
    },

    setPropsCollapsed: (propsCollapsed) => {
      get().setQuery({ propsCollapsed }, { push: false });
    },

    resetViewportParams: () => {
      get().setQuery({ zoom: null, panX: null, panY: null, rotated: false }, { push: false });
    },
  };
});
