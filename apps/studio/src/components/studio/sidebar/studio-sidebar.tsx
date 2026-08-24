import { useRef } from "react";

import { PanelLeft, PanelLeftClose } from "lucide-react";
import type { PanelSize } from "react-resizable-panels";

import { Button } from "@/components/ui/button";
import { IconTooltip, StudioTooltipProvider } from "@/components/studio/icon-tooltip";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useI18n } from "@/i18n";
import { useQueryStore, useShortcutsStore } from "@/stores";
import { cn } from "@/lib/utils";
import { LogoMenu } from "./logo-menu";
import { AgentsPanel } from "./panels/agents-panel";
import { PagesPanel } from "./panels/pages-panel";
import { VariablesPanel } from "./panels/variables-panel";
import { isSidebarTab, navTabs, type SidebarTab, type StudioSidebarProps } from "./types";

/** Default sidebar width in px (activity bar + content panel). */
const SIDEBAR_DEFAULT_WIDTH = 348;
/** Minimum sidebar width in px (drag floor; max is 60vw). */
const SIDEBAR_MIN_WIDTH = 240;

export function StudioSidebar({
  bootstrap,
  document,
  registry,
  selectedId,
  hoverNodeId,
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
  onApplyAgentActions,
  onSetVariable,
  onDeleteVariable,
  onRenameVariable,
}: StudioSidebarProps) {
  const { LL } = useI18n();
  const queryPanel = useQueryStore((s) => s.panel);
  const querySidebarCollapsed = useQueryStore((s) => s.sidebarCollapsed);
  const activeTab: SidebarTab = isSidebarTab(queryPanel) ? queryPanel : "pages";
  const panelCollapsed = querySidebarCollapsed;

  // Sidebar width is read once per expanded mount (first render and every
  // collapse→expand transition) rather than subscribed to: the resize handler
  // writes straight to the store, and re-rendering this tree mid-drag races
  // react-resizable-panels' pointer capture, freezing the drag after the
  // first move.
  const sidebarWidthRef = useRef<number | null>(null);
  const wasCollapsedRef = useRef(panelCollapsed);
  if (sidebarWidthRef.current === null || (wasCollapsedRef.current && !panelCollapsed)) {
    sidebarWidthRef.current = useQueryStore.getState().sidebarWidth ?? SIDEBAR_DEFAULT_WIDTH;
  }
  wasCollapsedRef.current = panelCollapsed;

  const handleSidebarResize = ({ inPixels }: PanelSize) => {
    const width = Math.round(inPixels);
    if (useQueryStore.getState().sidebarWidth !== width) {
      useQueryStore.getState().setSidebarWidth(width);
    }
  };

  const handleTabClick = (tab: SidebarTab) => {
    useQueryStore.getState().setQuery({ panel: tab, sidebarCollapsed: false });
  };

  const getTabLabel = (id: SidebarTab) => {
    switch (id) {
      case "pages":
        return LL.sidebar.pages();
      case "agents":
        return LL.sidebar.agents();
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
        <ResizablePanelGroup
          orientation="horizontal"
          className="pointer-events-none fixed inset-0 z-30"
        >
          {/* Resizable sidebar (activity bar + content panel), max 60vw */}
          <ResizablePanel
            id="studio-sidebar"
            defaultSize={sidebarWidthRef.current}
            minSize={SIDEBAR_MIN_WIDTH}
            maxSize="60vw"
            onResize={handleSidebarResize}
            className="pointer-events-auto"
          >
            <aside
              className="flex h-full w-full overflow-hidden bg-background/95 backdrop-blur select-none"
              aria-label="Figma-style Studio Sidebar"
            >
              <div className="relative flex h-full min-w-0 flex-1 [contain:layout_paint]">
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
                          {index === navTabs.length - 1 && (
                            <div className="my-1 h-px w-8 bg-border/80" />
                          )}
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

                {/* Docked Left Content Panel (flexible width) */}
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background/60">
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
                        onAddComponent={onAddComponent}
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
                        document={document}
                        selectedId={selectedId}
                        onSelectNode={onSelectNode}
                        onApplyAgentActions={onApplyAgentActions}
                      />
                    )}

                    {activeTab === "variables" && (
                      <VariablesPanel
                        locale={locale}
                        locales={locales}
                        onLocaleChange={onLocaleChange}
                        document={document}
                        onSetVariable={onSetVariable}
                        onDeleteVariable={onDeleteVariable}
                        onRenameVariable={onRenameVariable}
                        onSelectNode={onSelectNode}
                      />
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </ResizablePanel>
          <ResizableHandle withHandle className="pointer-events-auto" />
          {/* Transparent remainder: keeps the handle reachable, clicks pass through */}
          <ResizablePanel minSize={0} className="pointer-events-none" />
        </ResizablePanelGroup>
      )}
    </StudioTooltipProvider>
  );
}
