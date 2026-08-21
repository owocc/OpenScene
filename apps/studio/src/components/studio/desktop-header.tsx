import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import type { Surface } from "@/core/editor-state";
import type { StudioBootstrap } from "@/core/studio-bootstrap";
import { cn } from "@/lib/utils";

interface DesktopHeaderProps {
  bootstrap: StudioBootstrap;
  surface: Surface;
  revision: number;
  valid: boolean;
  onSurfaceChange: (surface: Surface) => void;
  onCopyJson: () => void;
  onSave: () => void;
}

const modeTabs: Array<{ value: Surface; label: string; shortcut: string }> = [
  { value: "developer", label: "开发者模式", shortcut: "⌘1" },
  { value: "preview", label: "预览模式", shortcut: "⌘2" },
  { value: "text", label: "文本编辑模式", shortcut: "⌘3" },
];

export function DesktopHeader({
  bootstrap,
  surface,
  revision,
  valid,
  onSurfaceChange,
  onCopyJson,
  onSave,
}: DesktopHeaderProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  return (
    <>
      <header className="relative z-40 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-border/80 bg-background/95 px-3 backdrop-blur">
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
            <DropdownMenuPortal>
              <DropdownMenuPositioner side="bottom" align="start" sideOffset={6}>
                <DropdownMenuContent>
                  <DropdownMenuLabel>File</DropdownMenuLabel>
                  <DropdownMenuItem onClick={onCopyJson}>
                    <span>Copy JSON snapshot</span>
                    <kbd>⌘C</kbd>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onSave}>
                    <span>Save document</span>
                    <kbd>⌘S</kbd>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>View</DropdownMenuLabel>
                  {modeTabs.map((tab) => (
                    <DropdownMenuItem key={tab.value} onClick={() => onSurfaceChange(tab.value)}>
                      <span>{tab.label}</span>
                      <kbd>{tab.shortcut}</kbd>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
                    <span>Keyboard shortcuts</span>
                    <kbd>⌘/</kbd>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuPositioner>
            </DropdownMenuPortal>
          </DropdownMenu>
          <Separator orientation="vertical" className="h-6" />
          <span className="hidden text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:inline">
            {valid ? "Valid" : "Needs review"} · rev {revision}
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
              <TabsTab key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center justify-end gap-2">
          <span className="hidden text-[10px] text-muted-foreground lg:inline">
            {bootstrap.capabilities.saveDraft ? "Draft changes" : "Local session"}
          </span>
          <Button size="sm" onClick={onSave} aria-label="Save document">
            保存
          </Button>
        </div>
      </header>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogViewport>
            <DialogPopup>
              <DialogTitle>Keyboard shortcuts</DialogTitle>
              <DialogDescription>快速切换模式和管理当前编辑会话。</DialogDescription>
              <div className="mt-5 grid gap-1.5">
                {[
                  ["开发者模式", "⌘1"],
                  ["预览模式", "⌘2"],
                  ["文本编辑模式", "⌘3"],
                  ["撤销 / 重做", "⌘Z / ⇧⌘Z"],
                  ["保存", "⌘S"],
                  ["关闭菜单或弹窗", "Esc"],
                ].map(([label, shortcut]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs"
                  >
                    <span>{label}</span>
                    <kbd className={cn("font-mono text-[10px] text-muted-foreground")}>
                      {shortcut}
                    </kbd>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setShortcutsOpen(false)}>
                  完成
                </Button>
              </div>
            </DialogPopup>
          </DialogViewport>
        </DialogPortal>
      </Dialog>
    </>
  );
}
