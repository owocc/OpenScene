import { describe, expect, test } from "vite-plus/test";
import { messages } from "../../app/ui/i18n";
import {
  buildHref,
  isAppScopedPath,
  isPersonalPath,
  navigationGroups,
  personalNavigationGroups,
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

  test("preserves mode, org slug, and app scope in links without leaking language to url", () => {
    expect(
      buildHref("/pages", { mode: "embedded", lang: "zh-CN", orgSlug: "acme", appId: "app_1" }),
    ).toBe("/acme/pages?mode=embedded&appId=app_1");
    expect(buildHref("/pages", { mode: "embedded", lang: "zh-CN", appId: "app_1" })).toBe(
      "/pages?mode=embedded&appId=app_1",
    );
  });
  test("distinguishes personal routes from org-scoped routes", () => {
    expect(isPersonalPath("/")).toBe(true);
    expect(isPersonalPath("/account")).toBe(true);
    expect(isPersonalPath("/settings")).toBe(true);
    expect(isPersonalPath("/login")).toBe(true);
    expect(isPersonalPath("/invite/123")).toBe(true);

    expect(isPersonalPath("/apps")).toBe(false);
    expect(isPersonalPath("/acme/apps")).toBe(false);
    expect(isPersonalPath("/acme/overview")).toBe(false);
    expect(isPersonalPath("/acme/organization")).toBe(false);
  });

  test("never prefixes org slug to personal routes in buildHref", () => {
    expect(buildHref("/", { orgSlug: "acme" })).toBe("/");
    expect(buildHref("/account", { orgSlug: "acme" })).toBe("/account");
    expect(buildHref("/settings", { orgSlug: "acme" })).toBe("/settings");

    // Org-scoped routes correctly receive orgSlug
    expect(buildHref("/apps", { orgSlug: "acme" })).toBe("/acme/apps");
    expect(buildHref("/overview", { orgSlug: "acme", appId: "app_1" })).toBe(
      "/acme/overview?appId=app_1",
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
  test("nests AI providers and global prompts under AI sub-menu", () => {
    const systemGroup = navigationGroups.find((group) => group.key === "system");
    expect(systemGroup?.label).toBe("");
    const aiSubMenu = systemGroup?.items.find(
      (item) => "type" in item && item.type === "sub" && item.key === "ai",
    );
    expect(aiSubMenu).toBeDefined();
    if (aiSubMenu && "items" in aiSubMenu) {
      expect(aiSubMenu.items).toContainEqual({
        href: "/ai",
        key: "aiProviders",
        icon: "sparkle",
      });
      expect(aiSubMenu.items).toContainEqual({
        href: "/system-prompt",
        key: "globalPrompts",
        icon: "shieldWarning",
      });
    }
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

  test("includes personal navigation in personalNavigationGroups", () => {
    const personalSystem = personalNavigationGroups.find((group) => group.label === "Account");
    expect(personalSystem?.items).toContainEqual({
      href: "/",
      key: "organizations",
      icon: "buildings",
      badge: "Beta",
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
