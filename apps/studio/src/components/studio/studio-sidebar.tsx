import { useState } from "react";
import {
  Briefcase,
  Check,
  Code2,
  Eye,
  FileText,
  Hexagon,
  PanelLeft,
  PanelLeftClose,
  Plus,
  PlusCircle,
  Search,
  Sparkles,
  SquareDashedMousePointer,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OutlineTree } from "@/components/studio/outline-tree";
import { IconTooltip, StudioTooltipProvider } from "@/components/studio/icon-tooltip";
import type { AppDocument } from "@/core/document";
import type { Surface } from "@/core/editor-state";
import type { AdapterRegistry } from "@/core/registry";
import type { StudioBootstrap } from "@/core/studio-bootstrap";
import { cn } from "@/lib/utils";

export type SidebarTab = "file" | "agents" | "assets" | "tools" | "variables";

export interface StudioSidebarProps {
  bootstrap: StudioBootstrap;
  document: AppDocument;
  registry: AdapterRegistry;
  selectedId: string;
  surface: Surface;
  revision: number;
  valid: boolean;
  locale: string;
  locales: string[];
  manifestVersion: string;
  components: Array<{ type: string; title: string; category?: string }>;
  diagnostics: Array<{ message: string }>;
  pastLength: number;
  futureLength: number;
  addType: string;
  onSetAddType: (type: string) => void;
  onAddComponent: () => void;
  onSelectNode: (nodeId: string | null) => void;
  onSurfaceChange: (surface: Surface) => void;
  onLocaleChange: (locale: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopyJson: () => void;
  onSave: () => void;
}

const navTabs: Array<{ id: SidebarTab; label: string; icon: LucideIcon }> = [
  { id: "file", label: "File", icon: FileText },
  { id: "agents", label: "Agents", icon: Sparkles },
  { id: "assets", label: "Assets", icon: PlusCircle },
  { id: "tools", label: "Tools", icon: Briefcase },
  { id: "variables", label: "Variables", icon: Hexagon },
];

const modeTabs: Array<{ value: Surface; label: string; shortcut: string; icon: LucideIcon }> = [
  { value: "developer", label: "开发者模式", shortcut: "⌘1", icon: Code2 },
  { value: "preview", label: "预览模式", shortcut: "⌘2", icon: Eye },
  { value: "text", label: "文档编辑模式", shortcut: "⌘3", icon: FileText },
];

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
  const [activeTab, setActiveTab] = useState<SidebarTab>("file");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");

  const handleTabClick = (tab: SidebarTab) => {
    if (activeTab === tab && !panelCollapsed) {
      setPanelCollapsed(true);
    } else {
      setActiveTab(tab);
      setPanelCollapsed(false);
    }
  };

  const filteredComponents = components.filter(
    (c) =>
      c.title.toLowerCase().includes(assetSearch.toLowerCase()) ||
      c.type.toLowerCase().includes(assetSearch.toLowerCase()),
  );

  return (
    <StudioTooltipProvider>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex h-full overflow-hidden border-r border-border/80 bg-background/95 backdrop-blur transition-[width] duration-200 select-none",
          panelCollapsed ? "w-[60px]" : "w-[348px]",
        )}
        aria-label="Figma-style Studio Sidebar"
      >
        {/* Fixed-width Inner Container: width stays strictly 348px to prevent text reflow */}
        <div className="relative flex h-full w-[348px] shrink-0 [contain:layout_paint]">
          {/* 1. Leftmost Activity Bar (Fixed 60px) */}
          <nav className="flex w-[60px] shrink-0 flex-col items-center border-r border-border/60 py-3">
            {/* Top Logo & Navigation Tabs */}
            <div className="flex w-full flex-col items-center gap-1">
              {/* Figma-style Main Menu Trigger (Logo) */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-xl text-foreground/90 transition-colors hover:bg-muted"
                      aria-label="OpenScene Studio"
                    />
                  }
                >
                  <SquareDashedMousePointer
                    className="size-5 text-foreground transition-transform group-hover:scale-105"
                    strokeWidth={1.8}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="start"
                  sideOffset={12}
                  className="min-w-60"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-semibold text-foreground">
                      {bootstrap.resource.title}
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />

                  {/* File Submenu */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <span>File</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-56">
                      <DropdownMenuItem onClick={onSave}>
                        <span>Save document</span>
                        <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onCopyJson}>
                        <span>Copy JSON snapshot</span>
                        <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {/* Edit Submenu */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <span>Edit</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-52">
                      <DropdownMenuItem onClick={onUndo} disabled={pastLength === 0}>
                        <span>Undo</span>
                        <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onRedo} disabled={futureLength === 0}>
                        <span>Redo</span>
                        <DropdownMenuShortcut>⇧⌘Z</DropdownMenuShortcut>
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {/* View Submenu */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <span>View</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-56">
                      {modeTabs.map((tab) => (
                        <DropdownMenuItem
                          key={tab.value}
                          onClick={() => onSurfaceChange(tab.value)}
                          className={cn(
                            surface === tab.value && "bg-muted font-medium text-foreground",
                          )}
                        >
                          <tab.icon className="size-4 text-muted-foreground" />
                          <span>{tab.label}</span>
                          <DropdownMenuShortcut>{tab.shortcut}</DropdownMenuShortcut>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setPanelCollapsed((c) => !c)}>
                        <PanelLeft className="size-4 text-muted-foreground" />
                        <span>
                          {panelCollapsed ? "Expand sidebar panel" : "Collapse sidebar panel"}
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
                    <span>Keyboard shortcuts</span>
                    <DropdownMenuShortcut>⌘/</DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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
                      aria-label={item.label}
                      aria-pressed={isActive}
                    >
                      <IconTooltip label={item.label} side="right">
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
                        {item.label}
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
              <IconTooltip label="收起面板" side="right">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-lg text-muted-foreground"
                  onClick={() => setPanelCollapsed(true)}
                  aria-label="收起面板"
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </IconTooltip>
            </div>

            {/* Dynamic Panel Content based on activeTab */}
            <div className="min-h-0 flex-1 overflow-auto">
              {/* TAB 1: File (Pages & Layers Outline) */}
              {activeTab === "file" && (
                <div className="flex flex-col p-2">
                  {/* Pages Section */}
                  <div className="mb-3">
                    <div className="mb-1.5 flex items-center justify-between px-2 text-[11px] font-semibold text-muted-foreground">
                      <span>Pages</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[10px] text-muted-foreground/80">1</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-accent/60 px-2.5 py-1.5 text-xs font-medium text-accent-foreground">
                      <FileText className="size-3.5 text-primary" />
                      <span className="truncate">{bootstrap.resource.title}</span>
                    </div>
                  </div>

                  {/* Layers / Nodes Section */}
                  <div className="flex-1">
                    <div className="mb-1.5 flex items-center justify-between px-2 text-[11px] font-semibold text-muted-foreground">
                      <span>Layers</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {Object.keys(document.spec.elements).length} 个节点
                      </span>
                    </div>

                    {document.spec.root ? (
                      <OutlineTree
                        document={document}
                        registry={registry}
                        selectedId={selectedId}
                        onSelect={onSelectNode}
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
                        当前文档为空。添加第一个 App 节点后，它会成为 root。
                      </div>
                    )}
                  </div>

                  {/* Bottom: App material contract quick add */}
                  <div className="mt-4 border-t border-border/80 pt-3">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      添加组件
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <select
                        className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                        value={addType}
                        onChange={(event) => onSetAddType(event.target.value)}
                        aria-label="Add App node"
                      >
                        <option value="">选择组件…</option>
                        {components.map((component) => (
                          <option key={component.type} value={component.type}>
                            {component.title}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onAddComponent}
                        disabled={!addType}
                      >
                        添加
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Agents (Material Contract & Diagnostics) */}
              {activeTab === "agents" && (
                <div className="flex flex-col gap-3 p-3 text-xs">
                  <div>
                    <div className="mb-1 text-xs font-semibold text-foreground">
                      App Material Contract
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Studio 通过契约驱动渲染，不维护本地固定组件目录。
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/40 p-3">
                    <div className="flex justify-between border-b border-border/50 py-1">
                      <span className="text-muted-foreground">App Key:</span>
                      <span className="font-mono font-medium text-foreground">
                        {bootstrap.app.key}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 py-1">
                      <span className="text-muted-foreground">协议版本:</span>
                      <span className="font-mono text-foreground">{manifestVersion}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 py-1">
                      <span className="text-muted-foreground">组件种类:</span>
                      <span className="font-medium text-foreground">{components.length} 种</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">契约状态:</span>
                      <span
                        className={cn(
                          "font-semibold",
                          valid ? "text-emerald-500" : "text-amber-500",
                        )}
                      >
                        {valid ? "Valid" : "Needs review"} · rev {revision}
                      </span>
                    </div>
                  </div>

                  {diagnostics.length > 0 && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-[11px]">
                      <div className="mb-1 font-semibold text-destructive">
                        Contract Diagnostics
                      </div>
                      <div className="grid gap-1 text-muted-foreground">
                        {diagnostics.map((d, i) => (
                          <div key={i}>• {d.message}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Assets (Component Catalog) */}
              {activeTab === "assets" && (
                <div className="flex flex-col p-3">
                  <div className="mb-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                      <input
                        className="h-8 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-xs outline-none focus-visible:border-ring"
                        placeholder="搜索物料组件…"
                        value={assetSearch}
                        onChange={(e) => setAssetSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    {filteredComponents.map((c) => (
                      <button
                        key={c.type}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          onSetAddType(c.type);
                          onAddComponent();
                        }}
                      >
                        <div>
                          <div className="text-xs font-semibold">{c.title}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {c.type}
                          </div>
                        </div>
                        <Plus className="size-3.5 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: Tools (Modes & Canvas Tools) */}
              {activeTab === "tools" && (
                <div className="flex flex-col gap-3 p-3">
                  <div>
                    <div className="mb-1 text-xs font-semibold text-foreground">编辑模式</div>
                    <div className="grid gap-1">
                      {modeTabs.map((tab) => (
                        <button
                          key={tab.value}
                          className={cn(
                            "flex items-center justify-between rounded-lg border p-2 text-xs transition-colors",
                            surface === tab.value
                              ? "border-primary/50 bg-primary/10 font-semibold text-primary"
                              : "border-border/60 bg-card hover:bg-muted",
                          )}
                          onClick={() => onSurfaceChange(tab.value)}
                        >
                          <div className="flex items-center gap-2">
                            <tab.icon className="size-4" />
                            <span>{tab.label}</span>
                          </div>
                          <kbd className="font-mono text-[10px] text-muted-foreground">
                            {tab.shortcut}
                          </kbd>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: Variables (i18n & State) */}
              {activeTab === "variables" && (
                <div className="flex flex-col gap-3 p-3">
                  <div>
                    <div className="mb-1 text-xs font-semibold text-foreground">
                      预览语言 (i18n)
                    </div>
                    <div className="grid gap-1">
                      {locales.map((item) => (
                        <button
                          key={item}
                          className={cn(
                            "flex items-center justify-between rounded-lg border p-2 text-xs transition-colors",
                            locale === item
                              ? "border-primary/50 bg-primary/10 font-semibold text-primary"
                              : "border-border/60 bg-card hover:bg-muted",
                          )}
                          onClick={() => onLocaleChange(item)}
                        >
                          <span>{item}</span>
                          {locale === item && <Check className="size-3.5 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Shortcuts Dialog */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>快速切换模式和管理当前编辑会话。</DialogDescription>
          <div className="mt-5 grid gap-1.5">
            {[
              ["开发者模式", "⌘1"],
              ["预览模式", "⌘2"],
              ["文档编辑模式", "⌘3"],
              ["撤销 / 重做", "⌘Z / ⇧⌘Z"],
              ["保存", "⌘S"],
              ["复制 JSON 快照", "⌘C"],
              ["关闭菜单或弹窗", "Esc"],
            ].map(([label, shortcut]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs"
              >
                <span>{label}</span>
                <kbd className={cn("font-mono text-[10px] text-muted-foreground")}>{shortcut}</kbd>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShortcutsOpen(false)}>
              完成
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </StudioTooltipProvider>
  );
}
