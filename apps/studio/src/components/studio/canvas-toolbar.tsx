import {
  Check,
  ChevronDown,
  Hand,
  Minus,
  MousePointer2,
  MousePointerClick,
  Plus,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { IconTooltip, TooltipProvider } from "@/components/ui/tooltip";
import type { ActiveToolMode, ViewportState } from "@/core/editor-state";
import { cn } from "@/lib/utils";

interface CanvasToolbarProps {
  activeToolMode: ActiveToolMode;
  viewport: Pick<ViewportState, "zoom" | "isRotated">;
  onToolChange: (mode: ActiveToolMode) => void;
  onZoomChange: (zoom: number) => void;
  onRotate: () => void;
}

const tools: Array<{ mode: ActiveToolMode; label: string; shortcut: string; icon: LucideIcon }> = [
  { mode: "select", label: "选择", shortcut: "V", icon: MousePointer2 },
  { mode: "interact", label: "交互", shortcut: "I", icon: MousePointerClick },
  { mode: "hand", label: "平移", shortcut: "H", icon: Hand },
];

export function CanvasToolbar({
  activeToolMode,
  viewport,
  onToolChange,
  onZoomChange,
  onRotate,
}: CanvasToolbarProps) {
  const currentTool = tools.find((tool) => tool.mode === activeToolMode) ?? tools[0];
  const CurrentIcon = currentTool.icon;

  return (
    <TooltipProvider>
      <div
        className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border/80 bg-background/95 p-1 shadow-xl shadow-slate-950/15 backdrop-blur"
        role="toolbar"
        aria-label="Canvas tools"
      >
        <ButtonGroup
          className="overflow-hidden rounded-lg border border-border/80 bg-background/80"
          aria-label="Canvas interaction"
        >
          <IconTooltip label={currentTool.label} side="top">
            <Button
              variant="secondary"
              size="icon-sm"
              className="rounded-none border-0"
              aria-label={currentTool.label}
              aria-pressed={true}
            >
              <CurrentIcon aria-hidden="true" />
            </Button>
          </IconTooltip>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="grid size-7 shrink-0 rounded-none border-0 border-l border-border/80 px-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-0"
              aria-label="选择画布工具"
            >
              <ChevronDown aria-hidden="true" className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuPositioner side="top" align="start" sideOffset={8}>
                <DropdownMenuContent>
                  {tools.map((tool) => {
                    const Icon = tool.icon;
                    const isActive = tool.mode === activeToolMode;
                    return (
                      <DropdownMenuItem
                        key={tool.mode}
                        onClick={() => onToolChange(tool.mode)}
                        className="gap-8"
                      >
                        <span className="flex items-center gap-2">
                          <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                          <span>{tool.label}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          {isActive && <Check aria-hidden="true" className="size-3.5" />}
                          <kbd className="font-mono text-[10px] text-muted-foreground">
                            {tool.shortcut}
                          </kbd>
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenuPositioner>
            </DropdownMenuPortal>
          </DropdownMenu>
        </ButtonGroup>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-0.5" role="group" aria-label="Canvas zoom">
          <IconTooltip label="缩小" side="top">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom out"
              onClick={() => onZoomChange(viewport.zoom - 0.1)}
            >
              <Minus aria-hidden="true" />
            </Button>
          </IconTooltip>
          <span className="w-9 text-center text-[10px] font-medium tabular-nums text-muted-foreground">
            {Math.round(viewport.zoom * 100)}%
          </span>
          <IconTooltip label="放大" side="top">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom in"
              onClick={() => onZoomChange(viewport.zoom + 0.1)}
            >
              <Plus aria-hidden="true" />
            </Button>
          </IconTooltip>
        </div>
        <Separator orientation="vertical" className="h-5" />
        <IconTooltip label={viewport.isRotated ? "恢复设备方向" : "旋转设备"} side="top">
          <Button
            variant={viewport.isRotated ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Rotate device"
            aria-pressed={viewport.isRotated}
            onClick={onRotate}
            className={cn(viewport.isRotated && "text-foreground")}
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        </IconTooltip>
      </div>
    </TooltipProvider>
  );
}
