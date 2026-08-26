export type AdminMode = "standalone" | "embedded";
export type AdminLanguage = "en" | "zh-CN";
export type AdminTheme = "system" | "light" | "dark";

export function parseMode(value: string | null | undefined): AdminMode {
  return value === "embedded" ? "embedded" : "standalone";
}

export function parseLanguage(value: string | null | undefined): AdminLanguage | undefined {
  return value === "en" || value === "zh-CN" ? value : undefined;
}

export function parseTheme(value: string | null | undefined): AdminTheme | undefined {
  return value === "system" || value === "light" || value === "dark" ? value : undefined;
}

/**
 * Checks if a path is a personal/global route (doesn't require an organization slug).
 */
export function isPersonalPath(pathname: string): boolean {
  const clean = pathname.split("?")[0];
  const segments = clean.split("/").filter(Boolean);
  if (segments.length === 0) return true; // root "/" is the personal organizations selection view
  const first = segments[0];
  return first === "account" || first === "settings" || first === "login" || first === "invite";
}

export function extractOrgSlugAndPath(pathname: string): { orgSlug: string; viewPath: string } {
  const clean = pathname.split("?")[0];
  const segments = clean.split("/").filter(Boolean);
  if (segments.length === 0) return { orgSlug: "", viewPath: "/" };

  if (
    segments[0] === "login" ||
    segments[0] === "api" ||
    segments[0] === "invite" ||
    segments[0] === "account" ||
    segments[0] === "settings"
  ) {
    return { orgSlug: "", viewPath: `/${segments.join("/")}` };
  }

  const knownRootViews = [
    "apps",
    "keys",
    "organization",
    "system",
    "ai",
    "system-prompt",
    "settings",
    "account",
    "overview",
    "pages",
    "templates",
    "components",
    "assets",
    "preview-profiles",
    "meta",
    "categories",
    "locales",
    "openapi-docs",
    "prompts",
    "prompt",
    "reference",
  ];

  if (knownRootViews.includes(segments[0])) {
    return { orgSlug: "", viewPath: `/${segments.join("/")}` };
  }

  const orgSlug = segments[0];
  const viewSegments = segments.slice(1);
  const viewPath = viewSegments.length > 0 ? `/${viewSegments.join("/")}` : "/apps";
  return { orgSlug, viewPath };
}

export function buildHref(
  path: string,
  context: { mode?: AdminMode; lang?: AdminLanguage; orgSlug?: string; appId?: string } = {},
  extra: Record<string, string | undefined> = {},
): string {
  const { viewPath: cleanViewPath, orgSlug: extractedSlug } = extractOrgSlugAndPath(path);
  const isPersonal = isPersonalPath(cleanViewPath);
  const orgSlug = isPersonal ? "" : context.orgSlug || extractedSlug || "";
  const basePath = orgSlug ? `/${orgSlug}${cleanViewPath}` : cleanViewPath;

  const params = new URLSearchParams();
  if (context.mode) params.set("mode", context.mode);
  if (context.lang) params.set("lang", context.lang);
  if (context.appId && !isPersonal) params.set("appId", context.appId);

  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function isAppScopedPath(pathname: string): boolean {
  const { viewPath } = extractOrgSlugAndPath(pathname);
  return (
    viewPath !== "/" &&
    viewPath !== "/apps" &&
    viewPath !== "/keys" &&
    viewPath !== "/system" &&
    viewPath !== "/login" &&
    viewPath !== "/ai" &&
    viewPath !== "/system-prompt" &&
    viewPath !== "/organization" &&
    !viewPath.startsWith("/invite") &&
    viewPath !== "/settings" &&
    viewPath !== "/account" &&
    viewPath !== "/reference"
  );
}

/**
 * Personal navigation items for the sidebar when in personal/global view mode.
 */
export const personalNavigationGroups = [
  {
    label: "Account",
    key: "system",
    items: [
      { href: "/", key: "organizations", icon: "buildings", badge: "Beta" },
      { href: "/account", key: "account", icon: "user" },
      { href: "/settings", key: "settings", icon: "sliders" },
    ],
  },
] as const;

/**
 * Organization-scoped navigation items (account, settings & org switcher moved to header navigation).
 */
export const navigationGroups = [
  {
    label: "System",
    key: "system",
    items: [
      { href: "/apps", key: "apps", icon: "squares" },
      { href: "/keys", key: "keys", icon: "key" },
      { href: "/system", key: "system", icon: "gear" },
      { href: "/ai", key: "ai", icon: "sparkle" },
      { href: "/system-prompt", key: "systemPrompt", icon: "shieldWarning" },
    ],
  },
  {
    label: "App",
    key: "app",
    items: [
      { href: "/overview", key: "overview", icon: "chart" },
      {
        type: "sub",
        key: "resources",
        icon: "folder",
        items: [
          { href: "/pages", key: "pages", icon: "file" },
          { href: "/templates", key: "templates", icon: "copy" },
          { href: "/assets", key: "assets", icon: "image" },
        ],
      },
      { href: "/components", key: "components", icon: "cubes" },
      { href: "/preview-profiles", key: "previewProfiles", icon: "eye" },
      { href: "/meta", key: "meta", icon: "code" },
      { href: "/categories", key: "categories", icon: "tag" },
      { href: "/locales", key: "locales", icon: "globe" },
      { href: "/openapi-docs", key: "openapiDocs", icon: "code" },
      { href: "/prompts", key: "prompts", icon: "chatText" },
    ],
  },
  {
    label: "Developer",
    key: "developer",
    items: [{ href: "/reference", key: "apiReference", icon: "book", target: "_blank" }],
  },
] as const;
