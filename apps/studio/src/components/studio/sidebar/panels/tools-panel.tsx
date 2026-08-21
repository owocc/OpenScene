import type { Surface } from "@/core/editor-state";
import { cn } from "@/lib/utils";
import { modeTabs } from "../types";

interface ToolsPanelProps {
  surface: Surface;
  onSurfaceChange: (surface: Surface) => void;
}

export function ToolsPanel({ surface, onSurfaceChange }: ToolsPanelProps) {
  return (
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
              <kbd className="font-mono text-[10px] text-muted-foreground">{tab.shortcut}</kbd>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
