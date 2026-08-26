"use client";

import {
  BookOpen,
  Buildings,
  CaretUpDown,
  ChartLine,
  ChatText,
  Cloud,
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
  MagnifyingGlass,
  Plus,
  Question,
  ShieldWarning,
  SignOut,
  SlidersHorizontal,
  Sparkle,
  SquaresFour,
  SunDim,
  Tag,
  User,
} from "@phosphor-icons/react";
import { OpenSceneLogo } from "./Logo";
import { Breadcrumbs } from "@cloudflare/kumo/components/breadcrumbs";
import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
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
import { useTheme } from "next-themes";
import { defaultRoleStatements, hasStatement } from "@/lib/permissions";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { useAdminContext, useI18n, type MessageKey } from "./i18n";
import {
  buildHref,
  isPersonalPath,
  navigationGroups,
  personalNavigationGroups,
} from "./navigation";
import { FullPageSkeleton } from "./PageSkeleton";
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
  const { theme, setTheme } = useTheme();
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
      const isPersonal = isPersonalPath(pathname) || isPersonalPath(context.viewPath);

      if (orgs.length === 0 && !isPersonal) {
        context.router.replace("/");
        return;
      }

      if (orgs.length > 0 && !isPersonal) {
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
  const apps = appsQuery.data?.items ?? [];
  const currentApp = apps.find((app) => app.id === context.appId);
  const appItems = Object.fromEntries(apps.map((app) => [app.id, app.name]));

  const memberRole = activeMember?.role;
  let activeStatements: Record<string, readonly string[]> = defaultRoleStatements.owner;
  if (memberRole && memberRole in defaultRoleStatements) {
    activeStatements = defaultRoleStatements[memberRole];
  } else if (memberRole) {
    activeStatements = defaultRoleStatements.admin;
  }
  const canManageAi = hasStatement(activeStatements, "ai", "manage");

  const isPersonal = isPersonalPath(pathname) || isPersonalPath(context.viewPath);
  const activeNavGroups = isPersonal ? personalNavigationGroups : navigationGroups;

  const normalizedNavigationSearch = navigationSearch.trim().toLocaleLowerCase();
  const filteredNavigationGroups = activeNavGroups
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
  if (isChecking) return <FullPageSkeleton />;
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
        <Sidebar.Header className="w-full border-b border-kumo-line p-2">
          <div className="flex h-12 items-center justify-between gap-2 px-1 group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:p-0">
            <a
              href="/"
              className="flex size-12 shrink-0 items-center justify-center text-kumo-default"
              aria-label="Home"
            >
              <OpenSceneLogo className="size-12 shrink-0 text-kumo-default" />
            </a>

            {!isPersonal && (
              <DropdownMenu>
                <DropdownMenu.Trigger
                  render={
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm font-semibold transition-colors hover:bg-kumo-fill cursor-pointer group-data-[state=collapsed]/sidebar:hidden"
                    >
                      <span className="truncate text-kumo-default">
                        {currentApp?.name || t("selectApp")}
                      </span>
                      <CaretUpDown size={14} className="shrink-0 text-kumo-subtle" />
                    </button>
                  }
                />
                <DropdownMenu.Content align="start" className="w-56">
                  <div className="px-3 py-1.5 text-xs font-semibold text-kumo-subtle uppercase">
                    {t("apps")}
                  </div>
                  {apps.map((app) => {
                    const isSelected = app.id === context.appId;
                    return (
                      <DropdownMenu.Item
                        key={app.id}
                        selected={isSelected}
                        icon={SquaresFour}
                        onClick={() => {
                          context.router.push(context.href("/overview", { appId: app.id }));
                        }}
                      >
                        <span className="truncate">{app.name}</span>
                      </DropdownMenu.Item>
                    );
                  })}
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    icon={Plus}
                    onClick={() => context.router.push(context.href("/apps"))}
                  >
                    {t("create")}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    icon={SquaresFour}
                    onClick={() => context.router.push(context.href("/apps"))}
                  >
                    {t("apps")}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            )}
          </div>
        </Sidebar.Header>
        <Sidebar.Content className="min-h-0 flex-1 overflow-y-auto">
          {/* Quick search (matching Image #1 and Image #2) */}
          <div className="relative mb-3 w-full">
            <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-kumo-subtle">
              <MagnifyingGlass size={15} />
            </span>
            <Input
              aria-label={t("search")}
              placeholder="Quick search..."
              value={navigationSearch}
              onChange={(event) => setNavigationSearch(event.target.value)}
              className="!pl-8 !pr-8 w-full text-xs"
            />
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-medium text-kumo-subtle">
              ⌘K
            </span>
          </div>
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
                    (directItem.href === "/" &&
                      (context.viewPath === "/" || context.viewPath === "/organization/select")) ||
                    (directItem.href !== "/" &&
                      (context.viewPath === directItem.href ||
                        (directItem.href !== "/apps" &&
                          context.viewPath.startsWith(`${directItem.href}/`))));
                  const isExternal = directItem.target === "_blank";
                  const itemHref = isExternal
                    ? directItem.href
                    : isPersonal
                      ? directItem.href
                      : context.href(directItem.href);
                  return (
                    <Sidebar.MenuButton
                      key={directItem.href}
                      href={itemHref}
                      icon={Icon}
                      active={active}
                      tooltip={t(directItem.key as MessageKey)}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noreferrer noopener" : undefined}
                    >
                      <span className="flex-1 truncate">{t(directItem.key as MessageKey)}</span>
                      {(directItem as { badge?: string }).badge ? (
                        <span className="ml-auto rounded border border-dashed border-kumo-line px-1.5 py-0.5 text-[10px] font-medium text-kumo-subtle group-data-[state=collapsed]/sidebar:hidden">
                          {(directItem as { badge?: string }).badge}
                        </span>
                      ) : null}
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
            {isPersonal ? (
              <Breadcrumbs size="sm">
                <Breadcrumbs.Current>
                  {context.viewPath === "/organization/new"
                    ? t("createNewOrg")
                    : context.viewPath === "/account"
                      ? t("account")
                      : context.viewPath === "/settings"
                        ? t("settings")
                        : t("organizations")}
                </Breadcrumbs.Current>
              </Breadcrumbs>
            ) : (
              <Breadcrumbs size="sm">
                <Breadcrumbs.Link href={context.href("/apps")}>
                  {activeOrg?.name || t("apps")}
                </Breadcrumbs.Link>
                <Breadcrumbs.Separator />
                <Breadcrumbs.Current>
                  {t((context.viewPath.slice(1).split("/")[0] || "overview") as MessageKey)}
                </Breadcrumbs.Current>
              </Breadcrumbs>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Support Link */}
            <LinkButton
              variant="ghost"
              size="sm"
              icon={Question}
              href="https://openscene.dev"
              target="_blank"
              rel="noreferrer noopener"
              className="hidden sm:inline-flex text-kumo-subtle hover:text-kumo-default gap-1.5 font-medium"
            >
              Support
            </LinkButton>

            {/* Profile Dropdown Menu */}
            {session?.user && (
              <DropdownMenu>
                <DropdownMenu.Trigger
                  render={
                    <button
                      type="button"
                      aria-label="User profile menu"
                      className="flex size-8 items-center justify-center rounded-full bg-kumo-fill text-kumo-subtle hover:bg-kumo-line hover:text-kumo-default transition-colors cursor-pointer"
                    >
                      <User size={18} weight="fill" />
                    </button>
                  }
                />
                <DropdownMenu.Content align="end" className="w-56">
                  <div className="px-3 py-2 text-xs font-medium text-kumo-subtle truncate max-w-[210px]">
                    {session.user.email || session.user.name}
                  </div>
                  <DropdownMenu.Separator />

                  {/* Organizations / Switch Organization */}
                  {orgs && orgs.length > 1 ? (
                    <DropdownMenu.Sub>
                      <DropdownMenu.SubTrigger icon={Buildings}>
                        {t("organizations")}
                      </DropdownMenu.SubTrigger>
                      <DropdownMenu.SubContent className="w-56">
                        <div className="px-3 py-1.5 text-xs font-semibold text-kumo-subtle uppercase">
                          {t("organizations")}
                        </div>
                        {(orgs as Array<{ id: string; name: string; slug: string }>).map((org) => {
                          const isSelected =
                            org.id === activeOrg?.id || org.slug === context.orgSlug;
                          return (
                            <DropdownMenu.Item
                              key={org.id}
                              selected={isSelected}
                              icon={Buildings}
                              onClick={async () => {
                                await authClient.organization.setActive({ organizationId: org.id });
                                void queryClient.invalidateQueries();
                                context.router.push(buildHref("/apps", { orgSlug: org.slug }));
                              }}
                            >
                              <span className="truncate">{org.name}</span>
                            </DropdownMenu.Item>
                          );
                        })}
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                          icon={Plus}
                          onClick={() => context.router.push("/organization/new")}
                        >
                          {t("createNewOrg")}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          icon={SquaresFour}
                          onClick={() => context.router.push("/")}
                        >
                          {t("organizations")}
                        </DropdownMenu.Item>
                      </DropdownMenu.SubContent>
                    </DropdownMenu.Sub>
                  ) : (
                    <DropdownMenu.Item icon={Buildings} onClick={() => context.router.push("/")}>
                      {t("organizations")}
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Item icon={User} onClick={() => context.router.push("/account")}>
                    {t("account")}
                  </DropdownMenu.Item>

                  <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger icon={SunDim}>{t("theme")}</DropdownMenu.SubTrigger>
                    <DropdownMenu.SubContent>
                      <DropdownMenu.Item
                        selected={theme === "system"}
                        onClick={() => setTheme("system")}
                      >
                        {t("themeSystem")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        selected={theme === "light"}
                        onClick={() => setTheme("light")}
                      >
                        {t("themeLight")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        selected={theme === "dark"}
                        onClick={() => setTheme("dark")}
                      >
                        {t("themeDark")}
                      </DropdownMenu.Item>
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Sub>

                  <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger icon={Globe}>{t("language")}</DropdownMenu.SubTrigger>
                    <DropdownMenu.SubContent>
                      <DropdownMenu.Item
                        selected={context.language === "en"}
                        onClick={() => context.setLanguage("en")}
                      >
                        {t("english")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        selected={context.language === "zh-CN"}
                        onClick={() => context.setLanguage("zh-CN")}
                      >
                        {t("chinese")}
                      </DropdownMenu.Item>
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Sub>

                  <DropdownMenu.Item
                    icon={SlidersHorizontal}
                    onClick={() => context.router.push("/settings")}
                  >
                    {t("settings")}
                  </DropdownMenu.Item>

                  <DropdownMenu.Separator />

                  <DropdownMenu.Item
                    variant="danger"
                    icon={SignOut}
                    onClick={async () => {
                      await signOut();
                      window.location.href = "/login";
                    }}
                  >
                    {t("signOut")}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            )}
          </div>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </Sidebar.Provider>
  );
}
