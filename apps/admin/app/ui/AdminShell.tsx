"use client";

import {
  BookOpen,
  ChartLine,
  Code,
  Copy,
  Cube,
  Eye,
  File,
  Gear,
  Globe,
  Image,
  SlidersHorizontal,
  Sparkle,
  SquaresFour,
  Tag,
} from "@phosphor-icons/react";
import { Breadcrumbs } from "@cloudflare/kumo/components/breadcrumbs";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api } from "./api";
import { useAdminContext, useI18n, type MessageKey } from "./i18n";
import { navigationGroups } from "./navigation";

const icons = {
  book: BookOpen,
  chart: ChartLine,
  code: Code,
  cubes: Cube,
  copy: Copy,
  eye: Eye,
  file: File,
  gear: Gear,
  globe: Globe,
  image: Image,
  sliders: SlidersHorizontal,
  sparkle: Sparkle,
  squares: SquaresFour,
  tag: Tag,
} as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const context = useAdminContext();
  const { t } = useI18n();
  const [navigationSearch, setNavigationSearch] = useState("");
  const appsQuery = api.useQuery("get", "/api/v1/apps", {
    params: { query: { limit: "100" } },
  });
  const appItems = Object.fromEntries(
    (appsQuery.data?.items ?? []).map((app) => [app.id, app.name]),
  );
  const normalizedNavigationSearch = navigationSearch.trim().toLocaleLowerCase();
  const filteredNavigationGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        t(item.key as MessageKey)
          .toLocaleLowerCase()
          .includes(normalizedNavigationSearch),
      ),
    }))
    .filter((group) => group.items.length > 0);

  if (pathname === "/login") return <main className="min-h-dvh">{children}</main>;
  if (context.mode === "embedded") return <main className="min-h-dvh">{children}</main>;

  return (
    <Sidebar.Provider
      defaultOpen
      collapsible="offcanvas"
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
              <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
              <Sidebar.Menu>
                {group.items.map((item) => {
                  const Icon = icons[item.icon];
                  const active =
                    pathname === item.href ||
                    (item.href !== "/apps" && pathname.startsWith(`${item.href}/`));
                  return (
                    <Sidebar.MenuButton
                      key={item.href}
                      href={context.href(item.href)}
                      icon={Icon}
                      active={active}
                    >
                      {t(item.key as MessageKey)}
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
              <Breadcrumbs.Link href={context.href("/apps")}>{t("apps")}</Breadcrumbs.Link>
              <Breadcrumbs.Separator />
              <Breadcrumbs.Current>
                {t((pathname.slice(1).split("/")[0] || "overview") as MessageKey)}
              </Breadcrumbs.Current>
            </Breadcrumbs>
          </div>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </Sidebar.Provider>
  );
}
