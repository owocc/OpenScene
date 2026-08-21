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
          <DropdownMenuSubTrigger>File</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={onSave}>
                Save document
                <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopyJson}>
                Copy JSON snapshot
                <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* Edit Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Edit</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={onUndo} disabled={pastLength === 0}>
                Undo
                <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRedo} disabled={futureLength === 0}>
                Redo
                <DropdownMenuShortcut>⇧⌘Z</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* View Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>View</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {modeTabs.map((tab) => (
                <DropdownMenuItem key={tab.value} onClick={() => onSurfaceChange(tab.value)}>
                  <tab.icon />
                  {tab.label}
                  <DropdownMenuShortcut>{tab.shortcut}</DropdownMenuShortcut>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onTogglePanel}>
                <PanelLeft />
                {panelCollapsed ? "Expand sidebar panel" : "Collapse sidebar panel"}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* Theme Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun />
                Light
                {theme === "light" && <span className="ms-auto text-xs">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon />
                Dark
                {theme === "dark" && <span className="ms-auto text-xs">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Laptop />
                System
                {theme === "system" && <span className="ms-auto text-xs">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenShortcuts}>
          Keyboard shortcuts
          <DropdownMenuShortcut>⌘/</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
