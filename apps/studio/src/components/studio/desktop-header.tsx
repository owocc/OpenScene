import { useState } from "react";
import { Code2, Eye, FileText, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconTooltip, StudioTooltipProvider } from "@/components/studio/icon-tooltip";
import type { Surface } from "@/core/editor-state";
import type { StudioBootstrap } from "@/core/studio-bootstrap";
import { cn } from "@/lib/utils";

interface DesktopHeaderProps {
  bootstrap: StudioBootstrap;
  surface: Surface;
  revision: number;
  valid: boolean;
  locale: string;
  locales: string[];
  manifestVersion: string;
  pastLength: number;
  futureLength: number;
  onSurfaceChange: (surface: Surface) => void;
  onLocaleChange: (locale: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopyJson: () => void;
  onSave: () => void;
}

const modeTabs: Array<{ value: Surface; label: string; shortcut: string; icon: LucideIcon }> = [
  { value: "developer", label: "开发者模式", shortcut: "⌘1", icon: Code2 },
  { value: "preview", label: "预览模式", shortcut: "⌘2", icon: Eye },
  { value: "text", label: "文档编辑模式", shortcut: "⌘3", icon: FileText },
];

export function DesktopHeader({
  bootstrap,
  surface,
  revision,
  valid,
  locale,
  locales,
  manifestVersion,
  pastLength,
  futureLength,
  onSurfaceChange,
  onLocaleChange,
  onUndo,
  onRedo,
  onCopyJson,
  onSave,
}: DesktopHeaderProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  return (
    <StudioTooltipProvider>
      <header className="relative z-40 grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-border/80 bg-background/95 px-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="group min-w-0 max-w-64 px-2 py-1.5 text-left hover:bg-muted"
              aria-label="Open file menu"
            >
              <span className="block truncate text-xs font-medium">{bootstrap.resource.title}</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground transition-colors group-hover:text-foreground">
                {bootstrap.resource.kind} · {bootstrap.app.name}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start" sideOffset={6}>
              <DropdownMenuGroup>
                <DropdownMenuLabel>File</DropdownMenuLabel>
                <DropdownMenuItem onClick={onCopyJson}>
                  <span>Copy JSON snapshot</span>
                  <kbd>⌘C</kbd>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSave}>
                  <span>Save document</span>
                  <kbd>⌘S</kbd>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>View</DropdownMenuLabel>
                {modeTabs.map((tab) => (
                  <DropdownMenuItem key={tab.value} onClick={() => onSurfaceChange(tab.value)}>
                    <span>{tab.label}</span>
                    <kbd>{tab.shortcut}</kbd>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
                <span>Keyboard shortcuts</span>
                <kbd>⌘/</kbd>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Separator orientation="vertical" className="h-6" />
          <span className="hidden text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:inline">
            {valid ? "Valid" : "Needs review"} · rev {revision}
          </span>
          <span className="hidden text-[10px] text-muted-foreground 2xl:inline">
            Canvas · iframe · {bootstrap.preview.profileId}
          </span>
        </div>

        <Tabs
          value={surface}
          onValueChange={(value) => {
            if (value === "developer" || value === "preview" || value === "text") {
              onSurfaceChange(value);
            }
          }}
          className="justify-self-center"
        >
          <TabsList aria-label="Editor mode">
            {modeTabs.map((tab) => (
              <IconTooltip key={tab.value} label={tab.label}>
                <TabsTrigger value={tab.value} aria-label={tab.label} className="size-7 px-2">
                  <tab.icon aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
                </TabsTrigger>
              </IconTooltip>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex min-w-0 items-center justify-end gap-1 whitespace-nowrap">
          <select
            className="hidden h-7 rounded-lg border border-input bg-background px-2 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring/30 lg:block"
            value={locale}
            onChange={(event) => onLocaleChange(event.target.value)}
            aria-label="Preview locale"
          >
            {locales.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <span className="hidden text-[10px] text-muted-foreground xl:inline">
            manifest {manifestVersion}
          </span>
          <span className="mx-1 hidden h-4 w-px bg-border lg:block" />
          <Button
            variant="ghost"
            size="xs"
            className="whitespace-nowrap"
            onClick={onUndo}
            disabled={pastLength === 0}
          >
            撤销
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className="whitespace-nowrap"
            onClick={onRedo}
            disabled={futureLength === 0}
          >
            重做
          </Button>
          <span className="mx-1 hidden h-4 w-px bg-border lg:block" />
          <span className="hidden text-[10px] text-muted-foreground 2xl:inline">
            {bootstrap.capabilities.saveDraft ? "Draft changes" : "Local session"}
          </span>
          <Button size="sm" onClick={onSave} aria-label="Save document">
            保存
          </Button>
        </div>
      </header>

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
