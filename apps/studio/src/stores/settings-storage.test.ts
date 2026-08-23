import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  loadAppViewSettings,
  loadPreferences,
  saveAppViewSettings,
  savePreferences,
} from "./settings-storage";

function memoryStorage(): { store: Map<string, string>; window: Window & typeof globalThis } {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
  const window = {
    localStorage,
    location: { search: "", hash: "" },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  } as unknown as Window & typeof globalThis;
  return { store, window };
}

describe("settings-storage preferences (app-wide)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores preferences under a fixed key shared by every app", () => {
    const { store, window } = memoryStorage();
    vi.stubGlobal("window", window);

    savePreferences({ locale: "zh-CN" });
    expect(store.has("openscene:studio:preferences")).toBe(true);
    expect(loadPreferences().locale).toBe("zh-CN");

    // A second save merges instead of replacing.
    savePreferences({});
    expect(loadPreferences().locale).toBe("zh-CN");
  });

  it("keeps preferences independent of the app id", () => {
    const { store, window } = memoryStorage();
    vi.stubGlobal("window", window);

    savePreferences({ locale: "en-US" });
    expect(loadAppViewSettings("app-1")).toEqual({});
    expect(store.size).toBe(1);
  });
});

describe("settings-storage view state (per app id)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("isolates view settings per app id", () => {
    const { store, window } = memoryStorage();
    vi.stubGlobal("window", window);

    saveAppViewSettings("app-1", { panel: "agents", zoom: 1.5 });
    saveAppViewSettings("app-2", { panel: "pages" });

    expect(loadAppViewSettings("app-1")).toEqual({ panel: "agents", zoom: 1.5 });
    expect(loadAppViewSettings("app-2")).toEqual({ panel: "pages" });
    expect(store.has("openscene:studio:view:app-1")).toBe(true);
    expect(store.has("openscene:studio:view:app-2")).toBe(true);
  });

  it("merges patches into existing view settings", () => {
    const { window } = memoryStorage();
    vi.stubGlobal("window", window);

    saveAppViewSettings("app-1", { zoom: 1.25, sidebarCollapsed: true });
    saveAppViewSettings("app-1", { zoom: 2 });
    expect(loadAppViewSettings("app-1")).toEqual({ zoom: 2, sidebarCollapsed: true });
  });

  it("returns empty settings when nothing is stored", () => {
    const { window } = memoryStorage();
    vi.stubGlobal("window", window);
    expect(loadAppViewSettings("missing-app")).toEqual({});
    expect(loadPreferences()).toEqual({});
  });
});
