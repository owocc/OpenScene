import { describe, expect, it } from "vite-plus/test";

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

    useQueryStore.getState().setPanel("variables");
    expect(useQueryStore.getState().panel).toBe("variables");
  });
});
