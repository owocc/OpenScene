import { Laptop, Moon, PanelLeft, SquareDashedMousePointer, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import { useI18n } from "@/i18n";
import type { Surface } from "@/core/editor-state";
import type { StudioBootstrap } from "@/core/studio-bootstrap";
import { modeTabs } from "./types";

interface LogoMenuProps {
  bootstrap: StudioBootstrap;
  pastLength: number;
  futureLength: number;
  panelCollapsed: boolean;
  onTogglePanel: () => void;
  onSurfaceChange: (surface: Surface) => void;
  onOpenShortcuts: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopyJson: () => void;
  onSave: () => void;
}

export function LogoMenu({
  bootstrap,
  pastLength,
  futureLength,
  panelCollapsed,
  onTogglePanel,
  onSurfaceChange,
  onOpenShortcuts,
  onUndo,
  onRedo,
  onCopyJson,
  onSave,
}: LogoMenuProps) {
  const { theme, setTheme } = useTheme();
  const { LL } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="OpenScene Studio" />}
      >
        <SquareDashedMousePointer />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start" side="bottom">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{bootstrap.resource.title}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {/* File Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{LL.menu.file()}</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={onSave}>
                {LL.menu.saveDocument()}
                <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopyJson}>
                {LL.menu.copyJson()}
                <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* Edit Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{LL.menu.edit()}</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={onUndo} disabled={pastLength === 0}>
                {LL.common.undo()}
                <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRedo} disabled={futureLength === 0}>
                {LL.common.redo()}
                <DropdownMenuShortcut>⇧⌘Z</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* View Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{LL.menu.view()}</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {modeTabs.map((tab) => (
                <DropdownMenuItem key={tab.value} onClick={() => onSurfaceChange(tab.value)}>
                  <tab.icon />
                  {tab.value === "developer"
                    ? LL.panels.tools.developer()
                    : tab.value === "preview"
                      ? LL.panels.tools.preview()
                      : LL.panels.tools.text()}
                  <DropdownMenuShortcut>{tab.shortcut}</DropdownMenuShortcut>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onTogglePanel}>
                <PanelLeft />
                {panelCollapsed ? LL.menu.expandSidebar() : LL.menu.collapseSidebar()}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* Theme Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{LL.menu.theme()}</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun />
                {LL.menu.light()}
                {theme === "light" && <span className="ms-auto text-xs">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon />
                {LL.menu.dark()}
                {theme === "dark" && <span className="ms-auto text-xs">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Laptop />
                {LL.menu.system()}
                {theme === "system" && <span className="ms-auto text-xs">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenShortcuts}>
          {LL.menu.shortcuts()}
          <DropdownMenuShortcut>⌘/</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
