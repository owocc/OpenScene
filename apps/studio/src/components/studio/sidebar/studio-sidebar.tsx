import { PanelLeft, PanelLeftClose } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconTooltip, StudioTooltipProvider } from "@/components/studio/icon-tooltip";
import { useI18n } from "@/i18n";
import { useQueryStore, useShortcutsStore } from "@/stores";
import { cn } from "@/lib/utils";
import { LogoMenu } from "./logo-menu";
import { AgentsPanel } from "./panels/agents-panel";
import { AssetsPanel } from "./panels/assets-panel";
import { PagesPanel } from "./panels/pages-panel";
import { ToolsPanel } from "./panels/tools-panel";
import { VariablesPanel } from "./panels/variables-panel";
import { isSidebarTab, navTabs, type SidebarTab, type StudioSidebarProps } from "./types";

export function StudioSidebar({
  bootstrap,
  document,
  registry,
  selectedId,
  hoverNodeId,
  surface,
  revision,
  valid,
  locale,
  locales,
  manifestVersion,
  components,
  diagnostics,
  pastLength,
  futureLength,
  viewport,
  onPatchViewport,
  onAddComponent,
  onSelectNode,
  onReorder,
  onSurfaceChange,
  onLocaleChange,
  onUndo,
  onRedo,
  onCopyJson,
  onSave,
}: StudioSidebarProps) {
  const { LL } = useI18n();
  const queryPanel = useQueryStore((s) => s.panel);
  const querySidebarCollapsed = useQueryStore((s) => s.sidebarCollapsed);
  const activeTab: SidebarTab = isSidebarTab(queryPanel) ? queryPanel : "pages";
  const panelCollapsed = querySidebarCollapsed;

  const handleTabClick = (tab: SidebarTab) => {
    useQueryStore.getState().setQuery({ panel: tab, sidebarCollapsed: false });
  };

  const getTabLabel = (id: SidebarTab) => {
    switch (id) {
      case "pages":
        return LL.sidebar.pages();
      case "agents":
        return LL.sidebar.agents();
      case "assets":
        return LL.sidebar.assets();
      case "tools":
        return LL.sidebar.tools();
      case "variables":
        return LL.sidebar.variables();
    }
  };

  const getTabTooltip = (id: SidebarTab) => {
    switch (id) {
      case "pages":
        return LL.sidebar.pagesTabTooltip();
      case "agents":
        return LL.sidebar.agentsTabTooltip();
      case "assets":
        return LL.sidebar.assetsTabTooltip();
      case "tools":
        return LL.sidebar.toolsTabTooltip();
      case "variables":
        return LL.sidebar.variablesTabTooltip();
    }
  };

  return (
    <StudioTooltipProvider>
      {/* 1. Collapsed State: Figma Floating Capsule Widget [Logo] Title [Badge] [|] */}
      {panelCollapsed && (
        <div
          className="fixed top-3 left-3 z-30 flex items-center gap-2 rounded-2xl border border-border/80 bg-background/95 p-1 shadow-sm backdrop-blur select-none"
          role="region"
          aria-label="Studio quick header"
        >
          {/* Logo Menu Trigger */}
          <LogoMenu
            pastLength={pastLength}
            futureLength={futureLength}
            viewport={viewport}
            panelCollapsed={panelCollapsed}
            onTogglePanel={() => useQueryStore.getState().setSidebarCollapsed(false)}
            onSurfaceChange={onSurfaceChange}
            onPatchViewport={onPatchViewport}
            onOpenShortcuts={() => useShortcutsStore.getState().openPanel()}
            onUndo={onUndo}
            onRedo={onRedo}
            onCopyJson={onCopyJson}
            onSave={onSave}
          />

          {/* Document Title (Limited to max 10 chars with tooltip for full title) */}
          <IconTooltip label={bootstrap.resource.title} side="bottom">
            <span className="cursor-default px-1 text-xs font-semibold text-foreground">
              {bootstrap.resource.title.length > 10
                ? `${bootstrap.resource.title.slice(0, 10)}…`
                : bootstrap.resource.title}
            </span>
          </IconTooltip>
          {/* Expand Sidebar Button */}
          <IconTooltip label={LL.sidebar.expand()} side="bottom">
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 rounded-xl text-muted-foreground hover:text-foreground"
              onClick={() => useQueryStore.getState().setSidebarCollapsed(false)}
              aria-label={LL.sidebar.expand()}
            >
              <PanelLeft className="size-4" />
            </Button>
          </IconTooltip>
        </div>
      )}

      {/* 2. Expanded State: Full-height Sidebar (Activity Bar + Left Content Panel) */}
      {!panelCollapsed && (
        <aside
          className="fixed inset-y-0 left-0 z-30 flex h-full w-[348px] overflow-hidden border-r border-border/80 bg-background/95 backdrop-blur select-none"
          aria-label="Figma-style Studio Sidebar"
        >
          <div className="relative flex h-full w-[348px] shrink-0 [contain:layout_paint]">
            {/* Leftmost Activity Bar (60px) */}
            <nav className="flex w-[60px] shrink-0 flex-col items-center border-r border-border/60 py-3">
              <div className="flex w-full flex-col items-center gap-1">
                {/* Logo Menu */}
                <LogoMenu
                  pastLength={pastLength}
                  futureLength={futureLength}
                  viewport={viewport}
                  panelCollapsed={panelCollapsed}
                  onTogglePanel={() => useQueryStore.getState().setSidebarCollapsed(true)}
                  onSurfaceChange={onSurfaceChange}
                  onPatchViewport={onPatchViewport}
                  onOpenShortcuts={() => useShortcutsStore.getState().openPanel()}
                  onUndo={onUndo}
                  onRedo={onRedo}
                  onCopyJson={onCopyJson}
                  onSave={onSave}
                />

                {/* Separator line */}
                <div className="my-1 h-px w-8 bg-border/80" />

                {/* Navigation Tabs: div (flex flex-col) > Button | text */}
                {navTabs.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <div key={item.id} className="flex w-full flex-col items-center">
                      {index === 4 && <div className="my-1 h-px w-8 bg-border/80" />}
                      <div
                        className="group flex w-full cursor-pointer flex-col items-center gap-0.5 py-1"
                        onClick={() => handleTabClick(item.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleTabClick(item.id);
                          }
                        }}
                        aria-label={getTabLabel(item.id)}
                        aria-pressed={isActive}
                      >
                        <IconTooltip label={getTabTooltip(item.id)} side="right">
                          <Button
                            variant={isActive ? "secondary" : "ghost"}
                            size="icon"
                            className="pointer-events-none size-9 rounded-xl"
                            tabIndex={-1}
                            aria-hidden="true"
                          >
                            <Icon className="size-4.5" strokeWidth={isActive ? 2 : 1.8} />
                          </Button>
                        </IconTooltip>
                        <span
                          className={cn(
                            "text-[10px] font-medium tracking-tight transition-colors select-none",
                            isActive
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          {getTabLabel(item.id)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </nav>

            {/* Docked Left Content Panel (288px / w-72) */}
            <div className="flex w-72 shrink-0 flex-col overflow-hidden bg-background/60">
              {/* Panel Top Header (Document Title & Collapse Button) */}
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/80 px-3">
                <span className="truncate text-xs font-semibold text-foreground">
                  {bootstrap.resource.title}
                </span>
                <IconTooltip label={LL.sidebar.collapse()} side="right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-lg text-muted-foreground"
                    onClick={() => useQueryStore.getState().setSidebarCollapsed(true)}
                    aria-label={LL.sidebar.collapse()}
                  >
                    <PanelLeftClose className="size-4" />
                  </Button>
                </IconTooltip>
              </div>

              {/* Dynamic Panel Content based on activeTab */}
              <div className="min-h-0 flex-1 overflow-auto">
                {activeTab === "pages" && (
                  <PagesPanel
                    title={bootstrap.resource.title}
                    document={document}
                    registry={registry}
                    selectedId={selectedId}
                    hoverNodeId={hoverNodeId}
                    onSelectNode={onSelectNode}
                    onReorder={onReorder}
                  />
                )}

                {activeTab === "agents" && (
                  <AgentsPanel
                    appKey={bootstrap.app.key}
                    manifestVersion={manifestVersion}
                    componentsCount={components.length}
                    valid={valid}
                    revision={revision}
                    diagnostics={diagnostics}
                  />
                )}

                {activeTab === "assets" && (
                  <AssetsPanel components={components} onSelectComponent={onAddComponent} />
                )}

                {activeTab === "tools" && (
                  <ToolsPanel surface={surface} onSurfaceChange={onSurfaceChange} />
                )}

                {activeTab === "variables" && (
                  <VariablesPanel
                    locale={locale}
                    locales={locales}
                    onLocaleChange={onLocaleChange}
                  />
                )}
              </div>
            </div>
          </div>
        </aside>
      )}
    </StudioTooltipProvider>
  );
}
