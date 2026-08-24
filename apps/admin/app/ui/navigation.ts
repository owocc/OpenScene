export type AdminMode = "standalone" | "embedded";
export type AdminLanguage = "en" | "zh-CN";

export function parseMode(value: string | null | undefined): AdminMode {
  return value === "embedded" ? "embedded" : "standalone";
}

export function parseLanguage(value: string | null | undefined): AdminLanguage | undefined {
  return value === "en" || value === "zh-CN" ? value : undefined;
}

export function buildHref(
  path: string,
  context: { mode: AdminMode; lang: AdminLanguage; appId?: string },
  extra: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  params.set("mode", context.mode);
  params.set("lang", context.lang);
  if (context.appId) params.set("appId", context.appId);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return `${path}?${params.toString()}`;
}

export function isAppScopedPath(pathname: string): boolean {
  return pathname !== "/apps" && pathname !== "/system" && pathname !== "/login";
}

export const navigationGroups = [
  {
    label: "Deployment",
    items: [
      { href: "/apps", key: "apps", icon: "squares" },
      { href: "/system", key: "system", icon: "gear" },
      { href: "/reference", key: "apiReference", icon: "book" },
    ],
  },
  {
    label: "App",
    items: [
      { href: "/overview", key: "overview", icon: "chart" },
      { href: "/pages", key: "pages", icon: "file" },
      { href: "/templates", key: "templates", icon: "copy" },
      { href: "/components", key: "components", icon: "cubes" },
      { href: "/preview-profiles", key: "previewProfiles", icon: "eye" },
      { href: "/assets", key: "assets", icon: "image" },
      { href: "/categories", key: "categories", icon: "tag" },
      { href: "/locales", key: "locales", icon: "globe" },
      { href: "/openapi-docs", key: "openapiDocs", icon: "code" },
      { href: "/settings", key: "settings", icon: "sliders" },
    ],
  },
] as const;
