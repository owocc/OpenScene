import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  DEFAULT_QUERY_PARAMS,
  formatQueryParams,
  parseQueryParams,
  useQueryStore,
} from "./query-store";

describe("query-store pure functions", () => {
  it("parses query parameters and hash token correctly", () => {
    const parsed = parseQueryParams(
      "?server-url=http%3A%2F%2Flocalhost%3A3000&sessionId=sess_123&surface=preview&nodeId=hero-1&tool=hand&zoom=1.5&panX=120&panY=80&rotated=true&panel=agents&sidebarCollapsed=true&propsCollapsed=true",
      "#token=secret_abc_123",
    );

    expect(parsed.serverUrl).toBe("http://localhost:3000");
    expect(parsed.sessionId).toBe("sess_123");
    expect(parsed.token).toBe("secret_abc_123");
    expect(parsed.surface).toBe("preview");
    expect(parsed.nodeId).toBe("hero-1");
    expect(parsed.tool).toBe("hand");
    expect(parsed.zoom).toBe(1.5);
    expect(parsed.panX).toBe(120);
    expect(parsed.panY).toBe(80);
    expect(parsed.rotated).toBe(true);
    expect(parsed.panel).toBe("agents");
    expect(parsed.sidebarCollapsed).toBe(true);
    expect(parsed.propsCollapsed).toBe(true);
  });

  it("supports camelCase serverUrl query parameter alias", () => {
    const parsed = parseQueryParams("?serverUrl=https%3A%2F%2Fapi.custom.com");
    expect(parsed.serverUrl).toBe("https://api.custom.com");
  });

  it("falls back to default parameters when search is empty", () => {
    const parsed = parseQueryParams("");
    expect(parsed.serverUrl).toBeNull();
    expect(parsed.surface).toBe(DEFAULT_QUERY_PARAMS.surface);
    expect(parsed.tool).toBe(DEFAULT_QUERY_PARAMS.tool);
    expect(parsed.panel).toBe(DEFAULT_QUERY_PARAMS.panel);
    expect(parsed.nodeId).toBeNull();
  });

  it("formats query parameters into clean search string and hash", () => {
    const formatted = formatQueryParams({
      ...DEFAULT_QUERY_PARAMS,
      serverUrl: "https://api.example.com",
      sessionId: "my-session",
      token: "xyz789",
      surface: "text",
      nodeId: "button-1",
      tool: "hand",
      zoom: 1.25,
      panX: 50,
      panY: -30,
      rotated: true,
      panel: "assets",
    });

    expect(formatted.search).toContain("server-url=https%3A%2F%2Fapi.example.com");
    expect(formatted.search).toContain("sessionId=my-session");
    expect(formatted.search).toContain("surface=text");
    expect(formatted.search).toContain("nodeId=button-1");
    expect(formatted.search).toContain("rotated=true");
    expect(formatted.search).toContain("panel=assets");
    expect(formatted.hash).toBe("#token=xyz789");
  });

  it("omits transient view state (tool/zoom/pan) from the URL", () => {
    const formatted = formatQueryParams({
      ...DEFAULT_QUERY_PARAMS,
      serverUrl: "https://api.example.com",
      tool: "hand",
      zoom: 0.38,
      panX: 299,
      panY: -239,
    });

    expect(formatted.search).toContain("server-url=https%3A%2F%2Fapi.example.com");
    expect(formatted.search).not.toContain("tool=");
    expect(formatted.search).not.toContain("zoom=");
    expect(formatted.search).not.toContain("panX=");
    expect(formatted.search).not.toContain("panY=");
  });

  it("omits default values to keep URL clean", () => {
    const formatted = formatQueryParams({
      ...DEFAULT_QUERY_PARAMS,
      serverUrl: "http://localhost:3000",
      sessionId: "local-test",
      surface: "visual", // default -> omitted
      tool: "select", // default -> omitted
      panel: "pages", // default -> omitted
    });

    expect(formatted.search).toContain("server-url=http%3A%2F%2Flocalhost%3A3000");
    expect(formatted.search).toContain("sessionId=local-test");
    expect(formatted.search).not.toContain("surface=");
    expect(formatted.search).not.toContain("tool=");
    expect(formatted.search).not.toContain("panel=");
    expect(formatted.hash).toBe("");
  });
});

describe("useQueryStore state operations", () => {
  it("updates state via actions correctly", () => {
    useQueryStore.getState().setServerUrl("https://api.test.com");
    expect(useQueryStore.getState().serverUrl).toBe("https://api.test.com");

    useQueryStore.getState().setSurface("preview");
    expect(useQueryStore.getState().surface).toBe("preview");

    useQueryStore.getState().setSelectedNodeId("box-456");
    expect(useQueryStore.getState().nodeId).toBe("box-456");

    useQueryStore.getState().setZoom(2);
    expect(useQueryStore.getState().zoom).toBe(2);

    useQueryStore.getState().setPropertiesWidth(360);
    expect(useQueryStore.getState().propertiesWidth).toBe(360);
  });
});

describe("applyAppSettings (bootstrap hydration)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubBrowser(seed: Record<string, string>) {
    const store = new Map<string, string>(Object.entries(seed));
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
        clear: () => store.clear(),
        key: (index: number) => [...store.keys()][index] ?? null,
        get length() {
          return store.size;
        },
      },
      location: { search: "", hash: "" },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      history: { replaceState: () => undefined, pushState: () => undefined },
    } as unknown as Window & typeof globalThis);
  }

  it("loads per-app view settings and global preferences after bootstrap", () => {
    stubBrowser({
      "openscene:studio:view:app-1": JSON.stringify({ panel: "assets", zoom: 2 }),
      "openscene:studio:preferences": JSON.stringify({ locale: "zh-CN" }),
    });

    useQueryStore.getState().applyAppSettings("app-1");
    const state = useQueryStore.getState();
    expect(state.appId).toBe("app-1");
    expect(state.panel).toBe("assets");
    expect(state.zoom).toBe(2);
    expect(state.locale).toBe("zh-CN");
  });

  it("restores the persisted properties panel width per app", () => {
    stubBrowser({
      "openscene:studio:view:app-5": JSON.stringify({ propertiesWidth: 420 }),
    });

    useQueryStore.getState().applyAppSettings("app-5");
    expect(useQueryStore.getState().propertiesWidth).toBe(420);
  });

  it("keys view state by app id so different apps stay isolated", () => {
    stubBrowser({
      "openscene:studio:view:app-1": JSON.stringify({ panel: "assets" }),
      "openscene:studio:view:app-2": JSON.stringify({ panel: "pages", rotated: true }),
      "openscene:studio:preferences": JSON.stringify({ locale: "en-US" }),
    });

    useQueryStore.getState().applyAppSettings("app-2");
    const state = useQueryStore.getState();
    expect(state.appId).toBe("app-2");
    expect(state.panel).toBe("pages");
    expect(state.rotated).toBe(true);
  });

  it("keeps URL query parameters authoritative over persisted values", () => {
    stubBrowser({
      "openscene:studio:view:app-1": JSON.stringify({ panel: "assets", zoom: 2 }),
    });
    const url = new URLSearchParams();
    url.set("panel", "tools");
    // Re-stub with an explicit URL param so the store sees it.
    const params = window.location as unknown as { search: string; hash: string };
    params.search = `?${url.toString()}`;

    useQueryStore.getState().applyAppSettings("app-3");
    expect(useQueryStore.getState().panel).toBe("tools");
  });
});
