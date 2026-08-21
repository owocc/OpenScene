import {
  Hand,
  Minus,
  MousePointer2,
  MousePointerClick,
  Plus,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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

const tools: Array<{ mode: ActiveToolMode; label: string; icon: LucideIcon }> = [
  { mode: "select", label: "选择", icon: MousePointer2 },
  { mode: "interact", label: "交互", icon: MousePointerClick },
  { mode: "hand", label: "平移", icon: Hand },
];

export function CanvasToolbar({
  activeToolMode,
  viewport,
  onToolChange,
  onZoomChange,
  onRotate,
}: CanvasToolbarProps) {
  return (
    <TooltipProvider>
      <div
        className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border/80 bg-background/95 p-1 shadow-xl shadow-slate-950/15 backdrop-blur"
        role="toolbar"
        aria-label="Canvas tools"
      >
        <div className="flex items-center gap-0.5" role="group" aria-label="Canvas interaction">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <IconTooltip key={tool.mode} label={tool.label} side="top">
                <Button
                  variant={activeToolMode === tool.mode ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label={tool.label}
                  aria-pressed={activeToolMode === tool.mode}
                  onClick={() => onToolChange(tool.mode)}
                >
                  <Icon aria-hidden="true" />
                </Button>
              </IconTooltip>
            );
          })}
        </div>
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
