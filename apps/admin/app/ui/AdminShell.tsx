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
import { CommandPalette } from "@cloudflare/kumo/components/command-palette";
import { Dialog } from "@cloudflare/kumo/components/dialog";
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
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgSlugEdited, setNewOrgSlugEdited] = useState(false);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { data: session, isPending: isSessionPending } = useSession();
  const { data: orgs } = useListOrganizations();
  const { data: activeOrg } = useActiveOrganization();
  const { data: activeMember } = useActiveMember();
  const queryClient = useQueryClient();

  async function handleCreateOrgSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim() || !newOrgSlug.trim()) return;
    setCreatingOrg(true);
    setCreateError(null);
    try {
      const cleanSlug =
        newOrgSlug
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "org";
      const res = await authClient.organization.create({
        name: newOrgName.trim(),
        slug: cleanSlug,
      });
      if (res?.error) {
        setCreateError(res.error.message || t("requestFailed"));
        setCreatingOrg(false);
        return;
      }
      setCreateOrgOpen(false);
      setNewOrgName("");
      setNewOrgSlug("");
      setNewOrgSlugEdited(false);
      void queryClient.invalidateQueries();
      window.location.href = buildHref("/apps", { orgSlug: cleanSlug });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t("requestFailed"));
      setCreatingOrg(false);
    }
  }
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
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
  const hasAppSelected = Boolean(context.appId);

  const filteredNavigationGroups = activeNavGroups
    .filter((group) => {
      // Hide the App menu group if no app is selected
      if (group.key === "app" && !hasAppSelected) {
        return false;
      }
      return true;
    })
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!canManageAi && item.key === "ai") {
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
  interface CommandItem {
    id: string;
    label: string;
    category: string;
    icon?: keyof typeof icons;
    action: () => void;
  }

  const commandItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // Personal / Global navigation items
    items.push({
      id: "nav-orgs",
      label: t("organizations"),
      category: "Account",
      icon: "buildings",
      action: () => context.router.push("/"),
    });
    items.push({
      id: "nav-account",
      label: t("account"),
      category: "Account",
      icon: "user",
      action: () => context.router.push("/account"),
    });
    items.push({
      id: "nav-settings",
      label: t("settings"),
      category: "Account",
      icon: "sliders",
      action: () => context.router.push("/settings"),
    });
    items.push({
      id: "nav-create-org",
      label: t("createNewOrg"),
      category: "Account",
      icon: "buildings",
      action: () => setCreateOrgOpen(true),
    });

    // Organization-scoped navigation items
    if (!isPersonal) {
      for (const group of navigationGroups) {
        if (group.key === "app" && !context.appId) {
          continue;
        }
        for (const navItem of group.items) {
          if ("type" in navItem && navItem.type === "sub") {
            for (const sub of navItem.items) {
              items.push({
                id: `nav-${sub.key}`,
                label: t(sub.key as MessageKey),
                category: group.label,
                icon: "file",
                action: () => context.router.push(context.href(sub.href)),
              });
            }
          } else {
            const direct = navItem as {
              href: string;
              key: string;
              icon: keyof typeof icons;
              target?: string;
            };
            items.push({
              id: `nav-${direct.key}`,
              label: t(direct.key as MessageKey),
              category: group.label,
              icon: direct.icon,
              action: () => {
                if (direct.target === "_blank") window.open(direct.href, "_blank");
                else context.router.push(context.href(direct.href));
              },
            });
          }
        }
      }

      // Apps in organization
      for (const app of apps) {
        items.push({
          id: `app-${app.id}`,
          label: `${t("app")}: ${app.name}`,
          category: t("apps"),
          icon: "squares",
          action: () => context.router.push(context.href("/overview", { appId: app.id })),
        });
      }
    }

    // Switch organizations
    if (orgs && orgs.length > 0) {
      for (const org of orgs as Array<{ id: string; name: string; slug: string }>) {
        items.push({
          id: `org-${org.id}`,
          label: `${t("organization")}: ${org.name}`,
          category: t("organizations"),
          icon: "buildings",
          action: async () => {
            await authClient.organization.setActive({ organizationId: org.id });
            void queryClient.invalidateQueries();
            context.router.push(buildHref("/apps", { orgSlug: org.slug }));
          },
        });
      }
    }

    return items;
  }, [t, context, isPersonal, apps, orgs, queryClient]);

  const filteredCommandItems = useMemo(() => {
    const q = commandSearch.trim().toLowerCase();
    if (!q) return commandItems;
    return commandItems.filter(
      (item) => item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q),
    );
  }, [commandItems, commandSearch]);
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
        <Sidebar.Header className="w-full border-b border-kumo-line p-2.5">
          <div className="flex h-9 items-center justify-between gap-2 px-1 group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0">
            <a
              href="/"
              className="translate-y-0.5 cursor-pointer origin-left scale-[0.833] group-not-data-[state=collapsed]/sidebar:scale-100 transition-transform duration-250 flex items-center justify-center shrink-0 text-kumo-default"
              aria-label="Home"
            >
              <div className="flex w-8 items-center justify-center shrink-0">
                <OpenSceneLogo className="w-8 h-auto shrink-0" />
              </div>
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
          {/* Quick search button that triggers CommandPalette */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="mb-3 flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-kumo-line bg-kumo-base px-2.5 py-1.5 text-xs text-kumo-subtle transition-colors hover:border-kumo-brand hover:bg-kumo-fill hover:text-kumo-default cursor-pointer group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0"
          >
            <div className="flex min-w-0 items-center gap-2">
              <MagnifyingGlass size={15} className="shrink-0" />
              <span className="truncate group-data-[state=collapsed]/sidebar:hidden">
                Quick search...
              </span>
            </div>
            <kbd className="rounded border border-kumo-line bg-kumo-canvas px-1.5 py-0.5 text-[10px] font-medium text-kumo-subtle group-data-[state=collapsed]/sidebar:hidden">
              ⌘K
            </kbd>
          </button>
          {filteredNavigationGroups.map((group, groupIndex) => {
            const hasLabel = Boolean(group.label && group.label.trim().length > 0);
            return (
              <Sidebar.Group key={group.label || group.key || groupIndex}>
                {hasLabel ? (
                  <Sidebar.GroupLabel>
                    {t(group.key as MessageKey) || group.label}
                  </Sidebar.GroupLabel>
                ) : null}
                <Sidebar.Menu>
                  {group.items.map((item) => {
                    if ("type" in item && item.type === "sub") {
                      const SubIcon = icons[item.icon as keyof typeof icons] ?? Folder;
                      return (
                        <Sidebar.MenuItem key={item.key}>
                          <Sidebar.Collapsible defaultOpen>
                            <Sidebar.CollapsibleTrigger
                              render={
                                <Sidebar.MenuButton
                                  icon={SubIcon}
                                  tooltip={t(item.key as MessageKey)}
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
                        (context.viewPath === "/" ||
                          context.viewPath === "/organization/select")) ||
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
            );
          })}
        </Sidebar.Content>
        <Sidebar.Footer>
          <Sidebar.Trigger aria-label="Toggle sidebar" />
        </Sidebar.Footer>
      </Sidebar>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-4 border-b border-kumo-line bg-kumo-canvas px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {isPersonal ? (
              <Breadcrumbs size="sm">
                <Breadcrumbs.Current>
                  {context.viewPath === "/account"
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
                        <DropdownMenu.Item icon={Plus} onClick={() => setCreateOrgOpen(true)}>
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

      {/* Command Palette Spotlight Search */}
      <CommandPalette.Root
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        items={commandItems}
        value={commandSearch}
        onValueChange={setCommandSearch}
        itemToStringValue={(item: { label: string }) => item.label}
        onSelect={(item: { action: () => void }) => {
          item.action();
          setCommandPaletteOpen(false);
        }}
      >
        <CommandPalette.Input placeholder="Type a command or search..." />
        <CommandPalette.List>
          {filteredCommandItems.length === 0 ? (
            <CommandPalette.Empty>{t("noResults")}</CommandPalette.Empty>
          ) : (
            filteredCommandItems.map((item) => {
              const Icon =
                item.icon && icons[item.icon as keyof typeof icons]
                  ? icons[item.icon as keyof typeof icons]
                  : Sparkle;
              return (
                <CommandPalette.Item
                  key={item.id}
                  value={item}
                  onClick={() => {
                    item.action();
                    setCommandPaletteOpen(false);
                  }}
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Icon size={16} className="shrink-0 text-kumo-subtle" />
                      <span className="truncate font-medium">{item.label}</span>
                    </div>
                    <span className="shrink-0 text-[10px] uppercase text-kumo-subtle">
                      {item.category}
                    </span>
                  </div>
                </CommandPalette.Item>
              );
            })
          )}
        </CommandPalette.List>
        <CommandPalette.Footer>
          <span className="flex items-center gap-3 text-xs text-kumo-subtle">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-kumo-line bg-kumo-base px-1.5 py-0.5 text-[10px]">
                ↑↓
              </kbd>{" "}
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-kumo-line bg-kumo-base px-1.5 py-0.5 text-[10px]">
                ↵
              </kbd>{" "}
              to select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-kumo-line bg-kumo-base px-1.5 py-0.5 text-[10px]">
                esc
              </kbd>{" "}
              to close
            </span>
          </span>
        </CommandPalette.Footer>
      </CommandPalette.Root>

      {/* Create Organization Modal Dialog */}
      <Dialog.Root open={createOrgOpen} onOpenChange={setCreateOrgOpen}>
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>{t("createOrganization")}</Dialog.Title>
          <Dialog.Description>{t("createOrgDescription")}</Dialog.Description>
          {createError && (
            <div className="rounded-lg border border-kumo-danger/20 bg-kumo-danger/10 p-3 text-xs text-kumo-danger font-medium mt-3">
              {createError}
            </div>
          )}
          <form onSubmit={handleCreateOrgSubmit} className="grid gap-4 py-4">
            <Input
              label={t("orgName")}
              placeholder="e.g. Acme Corp"
              value={newOrgName}
              onChange={(e) => {
                setNewOrgName(e.target.value);
                if (!newOrgSlugEdited) {
                  setNewOrgSlug(
                    e.target.value
                      .toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "") || "org",
                  );
                }
              }}
              required
            />
            <Input
              label={t("orgSlug")}
              placeholder="e.g. acme-corp"
              value={newOrgSlug}
              onChange={(e) => {
                setNewOrgSlugEdited(true);
                setNewOrgSlug(
                  e.target.value
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "") || "org",
                );
              }}
              required
            />
            <div className="flex justify-end gap-2 pt-3 border-t border-kumo-line">
              <Dialog.Close render={<Button type="button">{t("cancel")}</Button>} />
              <Button
                type="submit"
                variant="primary"
                loading={creatingOrg}
                disabled={!newOrgName.trim() || !newOrgSlug.trim()}
              >
                {t("createOrganization")}
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>
    </Sidebar.Provider>
  );
}
