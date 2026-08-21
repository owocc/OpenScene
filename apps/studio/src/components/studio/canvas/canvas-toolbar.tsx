import {
  Check,
  ChevronDown,
  Code2,
  Eye,
  FileText,
  Hand,
  MousePointer2,
  MousePointerClick,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconTooltip, StudioTooltipProvider } from "@/components/studio/icon-tooltip";
import type { ActiveToolMode, Surface, ViewportState } from "@/core/editor-state";
import { cn } from "@/lib/utils";

interface CanvasToolbarProps {
  activeToolMode: ActiveToolMode;
  viewport: Pick<ViewportState, "zoom" | "isRotated">;
  surface: Surface;
  onSurfaceChange: (surface: Surface) => void;
  onToolChange: (mode: ActiveToolMode) => void;
  onZoomChange: (zoom: number) => void;
  onRotate: () => void;
}

const tools: Array<{ mode: ActiveToolMode; label: string; shortcut: string; icon: LucideIcon }> = [
  { mode: "select", label: "选择", shortcut: "V", icon: MousePointer2 },
  { mode: "interact", label: "交互", shortcut: "I", icon: MousePointerClick },
  { mode: "hand", label: "平移", shortcut: "H", icon: Hand },
];

const surfaceModes: Array<{
  value: Surface;
  label: string;
  shortcut: string;
  icon: LucideIcon;
}> = [
  { value: "developer", label: "开发者模式", shortcut: "⌘1", icon: Code2 },
  { value: "preview", label: "预览模式", shortcut: "⌘2", icon: Eye },
  { value: "text", label: "文档编辑模式", shortcut: "⌘3", icon: FileText },
];

const zoomLevels = [0.25, 0.5, 0.75, 0.85, 1, 1.25, 1.5, 2, 3];

export function CanvasToolbar({
  activeToolMode,
  viewport,
  surface,
  onSurfaceChange,
  onToolChange,
  onZoomChange,
  onRotate,
}: CanvasToolbarProps) {
  const currentTool = tools.find((tool) => tool.mode === activeToolMode) ?? tools[0];
  const CurrentIcon = currentTool.icon;

  return (
    <StudioTooltipProvider>
      <div
        className="pointer-events-auto absolute bottom-4 left-1/2 z-30 -translate-x-1/2 select-none"
        role="toolbar"
        aria-label="Canvas tools and modes"
      >
        <div
          className="flex items-center gap-1.5 rounded-2xl border border-border/80 bg-background/95 p-1 shadow-xl shadow-slate-950/15 backdrop-blur"
          role="group"
          aria-label="Canvas tools"
        >
          {/* 1. Tool Selection Split Button */}
          <ButtonGroup className="overflow-hidden rounded-xl border border-border/50 bg-secondary/80">
            <IconTooltip label={currentTool.label} side="top">
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-none border-0 text-secondary-foreground hover:bg-secondary"
                aria-label={currentTool.label}
                aria-pressed={true}
              >
                <CurrentIcon aria-hidden="true" className="size-4" />
              </Button>
            </IconTooltip>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="grid size-7 shrink-0 place-items-center border-0 border-l border-border/50 px-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none"
                aria-label="选择画布工具"
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

          {/* 2. Zoom Ratio Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="h-7 min-w-12 rounded-xl border-0 px-2 text-[10px] font-medium tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none"
              aria-label="选择缩放比例"
            >
              {Math.round(viewport.zoom * 100)}%
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="center" sideOffset={8} className="min-w-28">
              <DropdownMenuGroup>
                <DropdownMenuLabel>缩放比例</DropdownMenuLabel>
                {zoomLevels.map((level) => {
                  const isActive = Math.abs(level - viewport.zoom) < 0.001;
                  return (
                    <DropdownMenuItem
                      key={level}
                      onClick={() => onZoomChange(level)}
                      className="justify-between"
                    >
                      <span>{Math.round(level * 100)}%</span>
                      {isActive && <Check aria-hidden="true" className="size-3.5 text-primary" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 3. Device Orientation Rotate */}
          <IconTooltip label={viewport.isRotated ? "恢复设备方向" : "旋转设备"} side="top">
            <Button
              variant={viewport.isRotated ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label="Rotate device"
              aria-pressed={viewport.isRotated}
              onClick={onRotate}
              className={cn("rounded-xl", viewport.isRotated && "text-foreground")}
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
            </Button>
          </IconTooltip>

          {/* 4. Vertical Divider Line */}
          <div className="mx-0.5 h-4 w-px bg-border/80" />

          {/* 5. Right Section: View Mode Switcher */}
          <div className="flex items-center gap-0.5 rounded-xl bg-muted/60 p-0.5">
            {surfaceModes.map((mode) => {
              const Icon = mode.icon;
              const isActive = surface === mode.value;
              return (
                <IconTooltip key={mode.value} label={`${mode.label} (${mode.shortcut})`} side="top">
                  <button
                    className={cn(
                      "flex size-7 items-center justify-center rounded-lg transition-all focus-visible:outline-none",
                      isActive
                        ? "bg-background text-foreground shadow-xs ring-1 ring-border/50"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                    )}
                    onClick={() => onSurfaceChange(mode.value)}
                    aria-label={mode.label}
                    aria-pressed={isActive}
                  >
                    <Icon className="size-3.5" strokeWidth={isActive ? 2 : 1.8} />
                  </button>
                </IconTooltip>
              );
            })}
          </div>
        </div>
      </div>
    </StudioTooltipProvider>
  );
}
