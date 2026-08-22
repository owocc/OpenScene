import { describe, expect, it } from "vite-plus/test";

import { namespaceForServer, settingsNamespaceFor } from "./settings-storage";

describe("settings-storage namespace", () => {
  it("uses the default namespace when no server is provided", () => {
    expect(namespaceForServer(null)).toBe("default");
    expect(namespaceForServer(undefined)).toBe("default");
    expect(namespaceForServer("")).toBe("default");
  });

  it("derives a stable namespace per server URL", () => {
    const first = namespaceForServer("http://localhost:3000");
    expect(namespaceForServer("http://localhost:3000")).toBe(first);
    expect(namespaceForServer("https://api.example.com")).not.toBe(first);
    expect(first).toMatch(/^server-[a-z0-9]+$/);
  });

  it("splits settings per session within a server", () => {
    const server = "http://localhost:3000";
    const first = settingsNamespaceFor(server, "sess_1");
    expect(settingsNamespaceFor(server, "sess_1")).toBe(first);
    expect(settingsNamespaceFor(server, "sess_2")).not.toBe(first);
    expect(first).toContain("session-");
  });

  it("falls back to the server namespace without a session id", () => {
    expect(settingsNamespaceFor("http://localhost:3000", null)).toBe(
      namespaceForServer("http://localhost:3000"),
    );
    expect(settingsNamespaceFor(null, "sess_1")).toMatch(/^default:session-/);
  });
});
