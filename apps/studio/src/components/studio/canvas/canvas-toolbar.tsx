import {
  Check,
  ChevronDown,
  Code2,
  FileText,
  Hand,
  MousePointer2,
  MousePointerClick,
  SquareMousePointer,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconTooltip, StudioTooltipProvider } from "@/components/studio/icon-tooltip";
import { LogoMenu } from "@/components/studio/sidebar/logo-menu";
import { useI18n } from "@/i18n";
import { useQueryStore, useShortcutsStore } from "@/stores";
import type { ActiveToolMode, Surface, ViewportState } from "@/core/editor-state";
import { cn } from "@/lib/utils";

interface CanvasToolbarProps {
  activeToolMode: ActiveToolMode;
  surface: Surface;
  onSurfaceChange: (surface: Surface) => void;
  onToolChange: (mode: ActiveToolMode) => void;
  pastLength?: number;
  futureLength?: number;
  viewport?: ViewportState;
  onPatchViewport?: (patch: Partial<ViewportState>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCopyJson?: () => void;
  onSave?: () => void;
  children?: React.ReactNode;
}

const toolIcons: Record<ActiveToolMode, { shortcut: string; icon: LucideIcon }> = {
  select: { shortcut: "V", icon: MousePointer2 },
  interact: { shortcut: "I", icon: MousePointerClick },
  hand: { shortcut: "H", icon: Hand },
};

const modeIcons: Array<{
  value: Surface;
  shortcut: string;
  icon: LucideIcon;
}> = [
  { value: "visual", shortcut: "⌘1", icon: SquareMousePointer },
  { value: "text", shortcut: "⌘2", icon: FileText },
  { value: "developer", shortcut: "⌘3", icon: Code2 },
];

export function CanvasToolbar({
  activeToolMode,
  surface,
  onSurfaceChange,
  onToolChange,
  pastLength = 0,
  futureLength = 0,
  viewport,
  onPatchViewport,
  onUndo,
  onRedo,
  onCopyJson,
  onSave,
  children,
}: CanvasToolbarProps) {
  const sidebarCollapsed = useQueryStore((s) => s.sidebarCollapsed);
  const { LL } = useI18n();

  const toolLabels: Record<ActiveToolMode, string> = {
    select: LL.toolbar.select(),
    interact: LL.toolbar.interact(),
    hand: LL.toolbar.pan(),
  };

  const currentIconData = toolIcons[activeToolMode] ?? toolIcons.select;
  const CurrentIcon = currentIconData.icon;
  const currentLabel = toolLabels[activeToolMode] ?? toolLabels.select;

  const tools: Array<{ mode: ActiveToolMode; label: string; shortcut: string; icon: LucideIcon }> =
    [
      { mode: "select", label: toolLabels.select, shortcut: "V", icon: MousePointer2 },
      { mode: "interact", label: toolLabels.interact, shortcut: "I", icon: MousePointerClick },
      { mode: "hand", label: toolLabels.hand, shortcut: "H", icon: Hand },
    ];

  return (
    <StudioTooltipProvider>
      {/*
        Outermost flex-col wrapper:
        - Transparent and ignores mouse events by default (pointer-events-none)
        - Uses flex-col layout to easily extend top/bottom content without manual positioning calculations
      */}
      <div
        className="pointer-events-none flex flex-col items-center gap-2 select-none"
        role="toolbar"
        aria-label="Canvas tools and modes"
      >
        {/* Main Toolbar Floating Bar (pointer-events-auto) */}
        <div
          className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-border/80 bg-background/95 p-1 shadow-xl shadow-slate-950/15 backdrop-blur"
          role="group"
          aria-label="Canvas tools"
        >
          {/* 1. In Document (text) Mode: Prepend Logo Menu as the first item */}
          {surface === "text" && (
            <>
              <LogoMenu
                side="top"
                align="start"
                sideOffset={8}
                triggerSize="icon-sm"
                triggerClassName="rounded-xl hover:bg-muted"
                pastLength={pastLength}
                futureLength={futureLength}
                viewport={viewport}
                panelCollapsed={sidebarCollapsed}
                onTogglePanel={() =>
                  useQueryStore.getState().setSidebarCollapsed(!sidebarCollapsed)
                }
                onSurfaceChange={onSurfaceChange}
                onPatchViewport={onPatchViewport}
                onOpenShortcuts={() => useShortcutsStore.getState().openPanel()}
                onUndo={onUndo ?? (() => {})}
                onRedo={onRedo ?? (() => {})}
                onCopyJson={onCopyJson ?? (() => {})}
                onSave={onSave ?? (() => {})}
              />
              <div className="mx-0.5 h-4 w-px bg-border/80" />
            </>
          )}

          {/* 2. Tool Selection Split Button (Available in all modes) */}
          <ButtonGroup className="overflow-hidden rounded-xl border border-border/50 bg-secondary/80">
            <IconTooltip label={currentLabel} side="top">
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-none border-0 text-secondary-foreground hover:bg-secondary"
                aria-label={currentLabel}
                aria-pressed={true}
              >
                <CurrentIcon aria-hidden="true" className="size-4" />
              </Button>
            </IconTooltip>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="grid size-7 shrink-0 place-items-center border-0 border-l border-border/50 px-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none"
                aria-label={LL.toolbar.select()}
              >
                <ChevronDown aria-hidden="true" className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" sideOffset={8} className="min-w-44">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  const isActive = tool.mode === activeToolMode;
                  return (
                    <DropdownMenuItem
                      key={tool.mode}
                      onClick={() => onToolChange(tool.mode)}
                      className="justify-between gap-4"
                    >
                      <span className="flex items-center gap-2">
                        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                        <span>{tool.label}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {isActive && <Check aria-hidden="true" className="size-3.5 text-primary" />}
                        <DropdownMenuShortcut className="font-mono text-[10px]">
                          {tool.shortcut}
                        </DropdownMenuShortcut>
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
          {/* 2. Vertical Divider Line */}
          <div className="mx-0.5 h-4 w-px bg-border/80" />

          {/* 3. Right Section: View Mode Switcher */}
          <div className="flex items-center gap-0.5 rounded-xl bg-muted/60 p-0.5">
            {modeIcons.map((mode) => {
              const Icon = mode.icon;
              const isActive = surface === mode.value;
              const modeLabel =
                mode.value === "visual"
                  ? LL.panels.tools.visual()
                  : mode.value === "text"
                    ? LL.panels.tools.text()
                    : LL.panels.tools.developer();

              return (
                <IconTooltip key={mode.value} label={`${modeLabel} (${mode.shortcut})`} side="top">
                  <button
                    className={cn(
                      "flex size-7 items-center justify-center rounded-lg transition-all focus-visible:outline-none",
                      isActive
                        ? "bg-background text-foreground shadow-xs ring-1 ring-border/50"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                    )}
                    onClick={() => onSurfaceChange(mode.value)}
                    aria-label={modeLabel}
                    aria-pressed={isActive}
                  >
                    <Icon className="size-3.5" strokeWidth={isActive ? 2 : 1.8} />
                  </button>
                </IconTooltip>
              );
            })}
          </div>
        </div>

        {/* Optional Extensible Children (Stacked in column flow) */}
        {children}
      </div>
    </StudioTooltipProvider>
  );
}
