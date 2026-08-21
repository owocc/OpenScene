import { useState } from "react";
import { PanelLeftClose } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconTooltip, StudioTooltipProvider } from "@/components/studio/icon-tooltip";
import { useI18n } from "@/i18n";
import { useQueryStore } from "@/stores";
import { cn } from "@/lib/utils";
import { LogoMenu } from "./logo-menu";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { AgentsPanel } from "./panels/agents-panel";
import { AssetsPanel } from "./panels/assets-panel";
import { FilePanel } from "./panels/file-panel";
import { ToolsPanel } from "./panels/tools-panel";
import { VariablesPanel } from "./panels/variables-panel";
import { navTabs, type SidebarTab, type StudioSidebarProps } from "./types";

export function StudioSidebar({
  bootstrap,
  document,
  registry,
  selectedId,
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
  addType,
  onSetAddType,
  onAddComponent,
  onSelectNode,
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
  const activeTab: SidebarTab = queryPanel || "file";
  const panelCollapsed = querySidebarCollapsed;
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const handleTabClick = (tab: SidebarTab) => {
    if (activeTab === tab && !panelCollapsed) {
      useQueryStore.getState().setSidebarCollapsed(true);
    } else {
      useQueryStore.getState().setQuery({ panel: tab, sidebarCollapsed: false });
    }
  };

  const getTabLabel = (id: SidebarTab) => {
    switch (id) {
      case "file":
        return LL.sidebar.file();
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
      case "file":
        return LL.sidebar.fileTabTooltip();
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
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex h-full overflow-hidden border-r border-border/80 bg-background/95 backdrop-blur select-none",
          panelCollapsed ? "w-[60px]" : "w-[348px]",
        )}
        aria-label="Figma-style Studio Sidebar"
      >
        {/* Fixed-width Inner Container: width stays strictly 348px to prevent text reflow */}
        <div className="relative flex h-full w-[348px] shrink-0 [contain:layout_paint]">
          {/* 1. Leftmost Activity Bar (Fixed 60px) */}
          <nav className="flex w-[60px] shrink-0 flex-col items-center border-r border-border/60 py-3">
            <div className="flex w-full flex-col items-center gap-1">
              {/* Logo Menu */}
              <LogoMenu
                pastLength={pastLength}
                futureLength={futureLength}
                viewport={viewport}
                panelCollapsed={panelCollapsed}
                onTogglePanel={() => useQueryStore.getState().setSidebarCollapsed(!panelCollapsed)}
                onSurfaceChange={onSurfaceChange}
                onPatchViewport={onPatchViewport}
                onOpenShortcuts={() => setShortcutsOpen(true)}
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
                const isActive = activeTab === item.id && !panelCollapsed;
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
                          className="size-9 rounded-xl pointer-events-none"
                          tabIndex={-1}
                          aria-hidden="true"
                        >
                          <Icon className="size-4.5" strokeWidth={isActive ? 2 : 1.8} />
                        </Button>
                      </IconTooltip>
                      <span
                        className={cn(
                          "text-[10px] font-medium tracking-tight select-none transition-colors",
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

          {/* 2. Docked Left Content Panel (Fixed 288px / w-72) */}
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
              {activeTab === "file" && (
                <FilePanel
                  title={bootstrap.resource.title}
                  document={document}
                  registry={registry}
                  selectedId={selectedId}
                  components={components}
                  addType={addType}
                  onSetAddType={onSetAddType}
                  onAddComponent={onAddComponent}
                  onSelectNode={onSelectNode}
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
                <AssetsPanel
                  components={components}
                  onSelectComponent={(type) => {
                    onSetAddType(type);
                    onAddComponent();
                  }}
                />
              )}

              {activeTab === "tools" && (
                <ToolsPanel surface={surface} onSurfaceChange={onSurfaceChange} />
              )}

              {activeTab === "variables" && (
                <VariablesPanel locale={locale} locales={locales} onLocaleChange={onLocaleChange} />
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Shortcuts Dialog */}
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </StudioTooltipProvider>
  );
}
