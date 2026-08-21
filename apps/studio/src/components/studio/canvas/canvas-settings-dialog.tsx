import { useState, type ComponentType } from "react";
import { Check, CircleDot, Grid3x3, LayoutGrid, type LucideIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { IconTooltip, StudioTooltipProvider } from "@/components/studio/icon-tooltip";
import { useI18n } from "@/i18n";
import { useCanvasSettingsStore, type BackgroundTexture } from "@/stores/canvas-settings-store";
import { cn } from "@/lib/utils";

interface SettingsSection {
  id: string;
  icon: LucideIcon;
  label: string;
}

const TEXTURE_SWATCHES: Record<BackgroundTexture, string> = {
  dots: "radial-gradient(circle, rgba(100,116,139,0.5) 1px, transparent 1px)",
  grid: "linear-gradient(to right, rgba(100,116,139,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.35) 1px, transparent 1px)",
};

interface TextureOption {
  id: BackgroundTexture;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

function Swatch({
  texture,
  className,
  muted = false,
}: {
  texture: BackgroundTexture;
  className?: string;
  muted?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "shrink-0 rounded-md border border-border/80 bg-background transition-opacity",
        className,
      )}
      style={{
        backgroundImage: TEXTURE_SWATCHES[texture],
        backgroundSize: "8px 8px",
        opacity: muted ? 0.35 : 1,
      }}
    />
  );
}

function BackgroundSection() {
  const { LL } = useI18n();
  const showBackgroundPattern = useCanvasSettingsStore((s) => s.showBackgroundPattern);
  const setShowBackgroundPattern = useCanvasSettingsStore((s) => s.setShowBackgroundPattern);
  const backgroundTexture = useCanvasSettingsStore((s) => s.backgroundTexture);
  const setBackgroundTexture = useCanvasSettingsStore((s) => s.setBackgroundTexture);

  const textureOptions: TextureOption[] = [
    { id: "dots", label: LL.canvasSettings.dots(), icon: CircleDot },
    { id: "grid", label: LL.canvasSettings.grid(), icon: Grid3x3 },
  ];

  return (
    <section aria-labelledby="canvas-settings-background-title" className="grid gap-5">
      <div>
        <h3 id="canvas-settings-background-title" className="text-sm font-semibold">
          {LL.canvasSettings.background()}
        </h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {LL.canvasSettings.backgroundDescription()}
        </p>
      </div>

      {/* Show/hide toggle — independent of texture choice */}
      <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-3">
        <Swatch texture={backgroundTexture} className="size-9" muted={!showBackgroundPattern} />
        <span className="min-w-0 flex-1 text-sm">{LL.menu.backgroundPattern()}</span>
        <Switch
          checked={showBackgroundPattern}
          onCheckedChange={(checked) => setShowBackgroundPattern(checked ?? false)}
          aria-label={LL.menu.backgroundPattern()}
        />
      </div>

      {/* Texture selection — applied when the pattern is shown */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground">
          {LL.canvasSettings.texture()}
        </h4>
        <div className="mt-2 grid gap-2">
          {textureOptions.map((option) => {
            const Icon = option.icon;
            const isActive = backgroundTexture === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setBackgroundTexture(option.id)}
                aria-pressed={isActive}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                  isActive
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:bg-accent/60",
                )}
              >
                <Swatch texture={option.id} className="size-9" />
                <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  {option.label}
                </span>
                {isActive && <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * Canvas Settings Dialog (Figma-style).
 *
 * Left icon sidebar (tooltips on hover) + right settings content.
 * Add new sections to `sections` and render them below; the sidebar stays
 * icon-only so additional configuration categories slot in without layout work.
 */
export function CanvasSettingsDialog() {
  const { LL } = useI18n();
  const isSettingsOpen = useCanvasSettingsStore((s) => s.isSettingsOpen);
  const closeSettings = useCanvasSettingsStore((s) => s.closeSettings);
  const [activeSection, setActiveSection] = useState("background");

  const sections: SettingsSection[] = [
    { id: "background", icon: LayoutGrid, label: LL.canvasSettings.background() },
  ];

  return (
    <Dialog open={isSettingsOpen} onOpenChange={(open) => !open && closeSettings()}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="flex min-h-0">
          {/* Left icon sidebar */}
          <StudioTooltipProvider>
            <aside className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border/80 bg-muted/20 py-4">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <IconTooltip key={section.id} label={section.label} side="right">
                    <button
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      aria-label={section.label}
                      aria-pressed={isActive}
                      className={cn(
                        "grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                        isActive && "bg-accent text-foreground",
                      )}
                    >
                      <Icon className="size-4.5" />
                    </button>
                  </IconTooltip>
                );
              })}
            </aside>
          </StudioTooltipProvider>

          {/* Right settings content */}
          <div className="min-w-0 flex-1 p-5">
            <DialogHeader>
              <DialogTitle>{LL.canvasSettings.title()}</DialogTitle>
              <DialogDescription>{LL.canvasSettings.description()}</DialogDescription>
            </DialogHeader>
            <div className="mt-5">{activeSection === "background" && <BackgroundSection />}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
