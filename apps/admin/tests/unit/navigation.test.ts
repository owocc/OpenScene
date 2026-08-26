import { describe, expect, test } from "vite-plus/test";
import { messages } from "../../app/ui/i18n";
import {
  buildHref,
  isAppScopedPath,
  navigationGroups,
  parseLanguage,
  parseMode,
  parseTheme,
} from "../../app/ui/navigation";

describe("admin navigation context", () => {
  test("defaults invalid modes and languages safely", () => {
    expect(parseMode(undefined)).toBe("standalone");
    expect(parseMode("invalid")).toBe("standalone");
    expect(parseMode("embedded")).toBe("embedded");
    expect(parseLanguage("fr")).toBeUndefined();
    expect(parseLanguage("zh-CN")).toBe("zh-CN");
    expect(parseTheme(undefined)).toBeUndefined();
    expect(parseTheme("invalid")).toBeUndefined();
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  test("preserves mode, language, org slug, and app scope in links", () => {
    expect(
      buildHref("/pages", { mode: "embedded", lang: "zh-CN", orgSlug: "acme", appId: "app_1" }),
    ).toBe("/acme/pages?mode=embedded&lang=zh-CN&appId=app_1");
    expect(buildHref("/pages", { mode: "embedded", lang: "zh-CN", appId: "app_1" })).toBe(
      "/default/pages?mode=embedded&lang=zh-CN&appId=app_1",
    );
  });

  test("keeps dictionary keys aligned", () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages["zh-CN"]).sort());
  });

  test("includes app-scoped Components navigation", () => {
    const navigationItems: Array<{ href?: string; key: string; icon?: string }> = [];
    for (const group of navigationGroups) {
      for (const item of group.items) {
        if ("type" in item && item.type === "sub") {
          for (const sub of item.items) {
            navigationItems.push(sub);
          }
        } else {
          navigationItems.push(item);
        }
      }
    }

    expect(navigationItems).toContainEqual({
      href: "/components",
      key: "components",
      icon: "cubes",
    });
    expect(navigationItems).toContainEqual({
      href: "/assets",
      key: "assets",
      icon: "image",
    });
  });

  test("identifies non-app-scoped and app-scoped paths correctly", () => {
    expect(isAppScopedPath("/settings")).toBe(false);
    expect(isAppScopedPath("/account")).toBe(false);
    expect(isAppScopedPath("/organization")).toBe(false);
    expect(isAppScopedPath("/apps")).toBe(false);
    expect(isAppScopedPath("/system")).toBe(false);
    expect(isAppScopedPath("/login")).toBe(false);
    expect(isAppScopedPath("/ai")).toBe(false);
    expect(isAppScopedPath("/system-prompt")).toBe(false);
    expect(isAppScopedPath("/reference")).toBe(false);
    expect(isAppScopedPath("/overview")).toBe(true);
    expect(isAppScopedPath("/pages")).toBe(true);
    expect(isAppScopedPath("/templates")).toBe(true);
    expect(isAppScopedPath("/components")).toBe(true);
    expect(isAppScopedPath("/meta")).toBe(true);
  });

  test("includes Settings and Account navigation in System group", () => {
    const systemGroup = navigationGroups.find((group) => group.label === "System");
    expect(systemGroup?.items).toContainEqual({
      href: "/organization",
      key: "organization",
      icon: "buildings",
    });
    expect(systemGroup?.items).toContainEqual({
      href: "/settings",
      key: "settings",
      icon: "sliders",
    });
    expect(systemGroup?.items).toContainEqual({
      href: "/account",
      key: "account",
      icon: "user",
    });
  });
  test("groups pages, templates, and assets in nested Resources sub-menu under App", () => {
    const appGroup = navigationGroups.find((group) => group.label === "App");
    const resourcesSub = appGroup?.items.find(
      (item) => "type" in item && item.type === "sub" && item.key === "resources",
    );
    expect(resourcesSub).toBeDefined();
    if (resourcesSub && "type" in resourcesSub && resourcesSub.type === "sub") {
      expect(resourcesSub.items.map((i) => i.key)).toEqual(["pages", "templates", "assets"]);
    }
  });

  test("includes API reference navigation in Developer group with _blank target", () => {
    const developerGroup = navigationGroups.find((group) => group.label === "Developer");
    expect(developerGroup?.items).toContainEqual({
      href: "/reference",
      key: "apiReference",
      icon: "book",
      target: "_blank",
    });
  });
});
