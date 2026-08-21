import { useI18n } from "@/i18n";
import type { Surface } from "@/core/editor-state";
import { cn } from "@/lib/utils";
import { modeTabs } from "../types";

interface ToolsPanelProps {
  surface: Surface;
  onSurfaceChange: (surface: Surface) => void;
}

export function ToolsPanel({ surface, onSurfaceChange }: ToolsPanelProps) {
  const { LL } = useI18n();

  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <div className="mb-1 text-xs font-semibold text-foreground">{LL.panels.tools.modes()}</div>
        <div className="grid gap-1">
          {modeTabs.map((tab) => {
            const label =
              tab.value === "visual"
                ? LL.panels.tools.visual()
                : tab.value === "text"
                  ? LL.panels.tools.text()
                  : tab.value === "developer"
                    ? LL.panels.tools.developer()
                    : LL.panels.tools.preview();
            return (
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
                  <span>{label}</span>
                </div>
                {tab.shortcut && (
                  <kbd className="font-mono text-[10px] text-muted-foreground">{tab.shortcut}</kbd>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
