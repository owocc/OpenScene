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

export const appScopedViews = new Set([
  "overview",
  "pages",
  "templates",
  "assets",
  "components",
  "preview-profiles",
  "meta",
  "categories",
  "locales",
  "openapi-docs",
  "prompts",
  "prompt",
  "settings",
]);

export function extractOrgSlugAndPath(pathname: string): {
  orgSlug: string;
  viewPath: string;
  appId?: string;
} {
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

  // Pattern A: /:orgSlug/:appId/:view... (e.g. /acme/app_123/overview, /acme/app_123/pages/p1)
  if (segments.length >= 3 && appScopedViews.has(segments[2])) {
    const orgSlug = segments[0];
    const appId = segments[1];
    const viewPath = `/${segments.slice(2).join("/")}`;
    return { orgSlug, viewPath, appId };
  }

  // Pattern B: Root-level views without org slug (e.g. /apps, /keys)
  if (knownRootViews.includes(segments[0])) {
    return { orgSlug: "", viewPath: `/${segments.join("/")}` };
  }

  // Pattern C: /:orgSlug/:view... (e.g. /acme/apps, /acme/keys, /acme/organization, /acme/overview)
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
  const {
    viewPath: cleanViewPath,
    orgSlug: extractedSlug,
    appId: extractedAppId,
  } = extractOrgSlugAndPath(path);
  const firstViewSegment = cleanViewPath.split("/").filter(Boolean)[0] || "";
  const isAppScoped = appScopedViews.has(firstViewSegment);
  const appId = extra.appId !== undefined ? extra.appId : context.appId || extractedAppId;
  const isPersonal = cleanViewPath === "/settings" ? !appId : isPersonalPath(cleanViewPath);
  const orgSlug = isPersonal ? "" : context.orgSlug || extractedSlug || "";

  let basePath = cleanViewPath;
  if (orgSlug) {
    if (isAppScoped && appId) {
      basePath = `/${orgSlug}/${appId}${cleanViewPath}`;
    } else {
      basePath = `/${orgSlug}${cleanViewPath}`;
    }
  }

  const params = new URLSearchParams();
  if (context.mode) params.set("mode", context.mode);

  for (const [key, value] of Object.entries(extra)) {
    if (key === "appId") continue; // appId is in route params now
    if (value) params.set(key, value);
    else params.delete(key);
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function isAppScopedPath(pathname: string): boolean {
  const { viewPath, appId } = extractOrgSlugAndPath(pathname);
  if (viewPath === "/settings") {
    return Boolean(appId);
  }
  const first = viewPath.split("/").filter(Boolean)[0] || "";
  return appScopedViews.has(first);
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

export const navigationGroups = [
  {
    label: "",
    key: "system",
    items: [
      { href: "/apps", key: "apps", icon: "squares" },
      { href: "/keys", key: "keys", icon: "key" },
      { href: "/organization", key: "organization", icon: "buildings" },
      { href: "/system", key: "system", icon: "gear" },
      {
        type: "sub",
        key: "ai",
        icon: "sparkle",
        items: [
          { href: "/ai", key: "aiProviders", icon: "sparkle" },
          { href: "/system-prompt", key: "globalPrompts", icon: "shieldWarning" },
        ],
      },
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
      {
        type: "sub",
        key: "developerConfig",
        icon: "code",
        items: [
          { href: "/components", key: "components", icon: "cubes" },
          { href: "/preview-profiles", key: "previewProfiles", icon: "eye" },
          { href: "/meta", key: "meta", icon: "code" },
          { href: "/openapi-docs", key: "openapiDocs", icon: "code" },
        ],
      },
      { href: "/categories", key: "categories", icon: "tag" },
      { href: "/locales", key: "locales", icon: "globe" },
      { href: "/prompts", key: "prompts", icon: "chatText" },
      { href: "/settings", key: "appSettings", icon: "sliders" },
    ],
  },
  {
    label: "Developer",
    key: "developer",
    items: [{ href: "/reference", key: "apiReference", icon: "book", target: "_blank" }],
  },
] as const;
