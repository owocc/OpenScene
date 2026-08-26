"use client";

import {
  BookOpen,
  Buildings,
  ChartLine,
  ChatText,
  Code,
  Copy,
  Cube,
  Eye,
  File,
  Folder,
  Gear,
  Globe,
  Image,
  Key,
  ShieldWarning,
  SlidersHorizontal,
  Sparkle,
  SquaresFour,
  Tag,
  User,
} from "@phosphor-icons/react";
import { Breadcrumbs } from "@cloudflare/kumo/components/breadcrumbs";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import {
  authClient,
  signOut,
  useActiveMember,
  useActiveOrganization,
  useListOrganizations,
  useSession,
} from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";
import { defaultRoleStatements, hasStatement } from "@/lib/permissions";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { useAdminContext, useI18n, type MessageKey } from "./i18n";
import { buildHref, navigationGroups } from "./navigation";
const icons = {
  book: BookOpen,
  buildings: Buildings,
  chart: ChartLine,
  chatText: ChatText,
  code: Code,
  cubes: Cube,
  copy: Copy,
  eye: Eye,
  file: File,
  folder: Folder,
  gear: Gear,
  globe: Globe,
  image: Image,
  key: Key,
  shieldWarning: ShieldWarning,
  sliders: SlidersHorizontal,
  sparkle: Sparkle,
  squares: SquaresFour,
  tag: Tag,
  user: User,
} as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const context = useAdminContext();
  const { t } = useI18n();
  const { data: session, isPending: isSessionPending } = useSession();
  const { data: orgs } = useListOrganizations();
  const { data: activeOrg } = useActiveOrganization();
  const { data: activeMember } = useActiveMember();
  const queryClient = useQueryClient();

  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    } else {
      const persisted = localStorage.getItem("openscene.sidebar.open");
      if (persisted !== null) {
        setSidebarOpen(persisted !== "false");
      }
    }
  }, []);

  const sessionQuery = api.useQuery("get", "/api/v1/auth/session");
  const isAuthenticated = Boolean(session?.user || sessionQuery.data?.authenticated);
  const isChecking = isSessionPending || sessionQuery.isLoading;

  useEffect(() => {
    if (pathname === "/login") return;
    if (context.mode === "embedded") return;
    if (!isAuthenticated && !isChecking) {
      const nextParam = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
      context.router.replace(`/login${nextParam}`);
      return;
    }

    // When logged in via session, verify organization access
    if (session?.user && Array.isArray(orgs)) {
      const isExemptPath =
        context.viewPath === "/organization/new" ||
        context.viewPath === "/organization/select" ||
        context.viewPath.startsWith("/invite");

      if (orgs.length === 0 && !isExemptPath) {
        context.router.replace("/organization/select");
        return;
      }

      if (orgs.length > 0 && !isExemptPath) {
        const userOrgs = orgs as Array<{ id: string; slug: string; name: string }>;
        const hasMatchingOrg = userOrgs.some((o) => o.slug === context.orgSlug);
        if (!hasMatchingOrg) {
          const targetOrg =
            activeOrg && userOrgs.some((o) => o.id === activeOrg.id) ? activeOrg : userOrgs[0];
          context.router.replace(
            buildHref(context.viewPath, {
              mode: context.mode,
              lang: context.language,
              orgSlug: targetOrg.slug,
              appId: context.appId,
            }),
          );
        }
      }
    }
  }, [pathname, isAuthenticated, isChecking, session, orgs, activeOrg, context]);
  const [navigationSearch, setNavigationSearch] = useState("");
  const appsQuery = api.useQuery("get", "/api/v1/apps", {
    params: { query: { limit: "100" } },
  });
  const appItems = Object.fromEntries(
    (appsQuery.data?.items ?? []).map((app) => [app.id, app.name]),
  );

  const memberRole = activeMember?.role;
  let activeStatements: Record<string, readonly string[]> = defaultRoleStatements.owner;
  if (memberRole && memberRole in defaultRoleStatements) {
    activeStatements = defaultRoleStatements[memberRole];
  } else if (memberRole) {
    activeStatements = defaultRoleStatements.admin;
  }
  const canManageAi = hasStatement(activeStatements, "ai", "manage");

  const normalizedNavigationSearch = navigationSearch.trim().toLocaleLowerCase();
  const filteredNavigationGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!canManageAi && (item.key === "ai" || item.key === "systemPrompt")) {
          return false;
        }
        if ("type" in item && item.type === "sub") {
          if (!normalizedNavigationSearch) return true;
          const subMatches = item.items.some((sub) =>
            t(sub.key as MessageKey)
              .toLocaleLowerCase()
              .includes(normalizedNavigationSearch),
          );
          const parentMatches = t(item.key as MessageKey)
            .toLocaleLowerCase()
            .includes(normalizedNavigationSearch);
          return parentMatches || subMatches;
        }
        if (!normalizedNavigationSearch) return true;
        return t(item.key as MessageKey)
          .toLocaleLowerCase()
          .includes(normalizedNavigationSearch);
      }),
    }))
    .filter((group) => group.items.length > 0);
  if (pathname === "/login") return <main className="min-h-dvh">{children}</main>;
  if (context.mode === "embedded") return <main className="min-h-dvh">{children}</main>;
  if (!isAuthenticated && !isChecking) return null;
  return (
    <Sidebar.Provider
      open={sidebarOpen}
      onOpenChange={(open) => {
        setSidebarOpen(open);
        if (typeof window !== "undefined" && window.innerWidth >= 768) {
          try {
            localStorage.setItem("openscene.sidebar.open", String(open));
          } catch {}
        }
      }}
      collapsible="icon"
      peekable
      mobileBreakpoint={768}
      className="h-dvh min-h-0 overflow-hidden"
    >
      <Sidebar className="h-full border-r border-kumo-line" fullScreenOnMobile>
        <Sidebar.Header className="w-full border-b border-kumo-line">
          <div className="w-full min-w-0">
            <Select
              aria-label={t("selectApp")}
              placeholder={t("selectApp")}
              value={context.appId ?? null}
              items={appItems}
              className="!w-full min-w-0"
              onValueChange={(value) => {
                if (typeof value === "string")
                  context.router.push(context.href("/overview", { appId: value }));
              }}
            />
          </div>
        </Sidebar.Header>
        <Sidebar.Content className="min-h-0 flex-1 overflow-y-auto">
          <Input
            aria-label={t("search")}
            placeholder={t("search")}
            value={navigationSearch}
            onChange={(event) => setNavigationSearch(event.target.value)}
            className="mb-3 w-full"
          />
          {filteredNavigationGroups.map((group) => (
            <Sidebar.Group key={group.label}>
              <Sidebar.GroupLabel>{t(group.key as MessageKey) || group.label}</Sidebar.GroupLabel>
              <Sidebar.Menu>
                {group.items.map((item) => {
                  if ("type" in item && item.type === "sub") {
                    const isAnySubActive = item.items.some(
                      (sub) =>
                        context.viewPath === sub.href ||
                        context.viewPath.startsWith(`${sub.href}/`),
                    );
                    const SubIcon = icons[item.icon as keyof typeof icons] ?? Folder;
                    return (
                      <Sidebar.MenuItem key={item.key}>
                        <Sidebar.Collapsible defaultOpen>
                          <Sidebar.CollapsibleTrigger
                            render={
                              <Sidebar.MenuButton
                                icon={SubIcon}
                                tooltip={t(item.key as MessageKey)}
                                active={isAnySubActive}
                              >
                                {t(item.key as MessageKey)} <Sidebar.MenuChevron />
                              </Sidebar.MenuButton>
                            }
                          />
                          <Sidebar.CollapsibleContent>
                            <Sidebar.MenuSub>
                              {item.items.map((sub) => {
                                const subActive =
                                  context.viewPath === sub.href ||
                                  context.viewPath.startsWith(`${sub.href}/`);
                                return (
                                  <Sidebar.MenuSubButton
                                    key={sub.href}
                                    href={context.href(sub.href)}
                                    active={subActive}
                                  >
                                    {t(sub.key as MessageKey)}
                                  </Sidebar.MenuSubButton>
                                );
                              })}
                            </Sidebar.MenuSub>
                          </Sidebar.CollapsibleContent>
                        </Sidebar.Collapsible>
                      </Sidebar.MenuItem>
                    );
                  }

                  const directItem = item as {
                    href: string;
                    key: string;
                    icon: keyof typeof icons;
                    target?: string;
                  };
                  const Icon = icons[directItem.icon];
                  const active =
                    context.viewPath === directItem.href ||
                    (directItem.href !== "/apps" &&
                      context.viewPath.startsWith(`${directItem.href}/`));
                  const isExternal = directItem.target === "_blank";
                  return (
                    <Sidebar.MenuButton
                      key={directItem.href}
                      href={isExternal ? directItem.href : context.href(directItem.href)}
                      icon={Icon}
                      active={active}
                      tooltip={t(directItem.key as MessageKey)}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noreferrer noopener" : undefined}
                    >
                      {t(directItem.key as MessageKey)}
                    </Sidebar.MenuButton>
                  );
                })}
              </Sidebar.Menu>
            </Sidebar.Group>
          ))}
        </Sidebar.Content>
        <Sidebar.Footer>
          <Sidebar.Trigger aria-label="Toggle sidebar" />
        </Sidebar.Footer>
      </Sidebar>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-4 border-b border-kumo-line bg-kumo-canvas px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Sidebar.Trigger aria-label="Open sidebar" />
            <Breadcrumbs size="sm">
              <Breadcrumbs.Link href={context.href("/apps")}>
                {activeOrg?.name || t("apps")}
              </Breadcrumbs.Link>
              <Breadcrumbs.Separator />
              <Breadcrumbs.Current>
                {t((context.viewPath.slice(1).split("/")[0] || "overview") as MessageKey)}
              </Breadcrumbs.Current>
            </Breadcrumbs>
          </div>
          <div className="flex items-center gap-3">
            {orgs && orgs.length > 0 && (
              <div className="w-40 sm:w-48">
                <Select
                  aria-label={t("orgSwitcher")}
                  placeholder={t("orgSwitcher")}
                  value={activeOrg?.id ?? orgs[0]?.id ?? null}
                  items={Object.fromEntries(
                    (orgs as Array<{ id: string; name: string }>).map((org) => [org.id, org.name]),
                  )}
                  className="!w-full min-w-0"
                  onValueChange={async (value) => {
                    if (typeof value === "string") {
                      await authClient.organization.setActive({ organizationId: value });
                      void queryClient.invalidateQueries();
                      const targetOrg = (
                        orgs as Array<{ id: string; slug: string }> | undefined
                      )?.find((o) => o.id === value);
                      const nextSlug = targetOrg?.slug || "default";
                      context.router.push(
                        buildHref(context.viewPath, {
                          mode: context.mode,
                          lang: context.language,
                          orgSlug: nextSlug,
                          appId: context.appId,
                        }),
                      );
                    }
                  }}
                />
              </div>
            )}
            {session?.user && (
              <div className="flex items-center gap-3 text-sm text-kumo-subtle">
                <span className="hidden sm:inline-block truncate max-w-[180px]">
                  {session.user.name || session.user.email}
                </span>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={async () => {
                    await signOut();
                    window.location.href = "/login";
                  }}
                >
                  {t("signOut")}
                </Button>
              </div>
            )}
          </div>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </Sidebar.Provider>
  );
}
