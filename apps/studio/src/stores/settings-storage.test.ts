import { describe, expect, it } from "vite-plus/test";

import { namespaceForServer } from "./settings-storage";

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
});
