import {
  Laptop,
  Maximize2,
  Moon,
  PanelLeft,
  RotateCcw,
  Smartphone,
  SquareDashedMousePointer,
  Sun,
  Tablet,
  ZoomIn,
  Languages,
} from "lucide-react";

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
import { useQueryStore } from "@/stores";
import type { Surface, ViewportState } from "@/core/editor-state";
import { devicePresets, modeTabs } from "./types";

export interface LogoMenuProps {
  pastLength: number;
  futureLength: number;
  viewport?: ViewportState;
  panelCollapsed: boolean;
  onTogglePanel: () => void;
  onSurfaceChange: (surface: Surface) => void;
  onPatchViewport?: (patch: Partial<ViewportState>) => void;
  onOpenShortcuts: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopyJson: () => void;
  onSave: () => void;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  triggerSize?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-xs";
  triggerClassName?: string;
}
const zoomLevels = [0.25, 0.5, 0.75, 0.85, 1, 1.25, 1.5, 2, 3];

export function LogoMenu({
  pastLength,
  futureLength,
  viewport,
  panelCollapsed,
  onTogglePanel,
  onSurfaceChange,
  onPatchViewport,
  onOpenShortcuts,
  onUndo,
  onRedo,
  onCopyJson,
  onSave,
  side = "bottom",
  align = "start",
  sideOffset = 4,
  triggerSize = "icon",
  triggerClassName,
}: LogoMenuProps) {
  const { theme, setTheme } = useTheme();
  const { LL, locale } = useI18n();

  const currentZoom = viewport?.zoom ?? 0.85;
  const isRotated = viewport?.isRotated ?? false;
  const currentWidth = viewport?.currentDeviceWidth ?? 390;
  const currentHeight = viewport?.currentDeviceHeight ?? 844;

  const mobilePresets = devicePresets.filter((p) => p.category === "mobile");
  const tabletPresets = devicePresets.filter((p) => p.category === "tablet");
  const desktopPresets = devicePresets.filter((p) => p.category === "desktop");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size={triggerSize}
            className={triggerClassName}
            aria-label="OpenScene Studio"
          />
        }
      >
        <SquareDashedMousePointer className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align={align} side={side} sideOffset={sideOffset}>
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
            <DropdownMenuSubContent className="min-w-56">
              {/* 1. Surface Modes */}
              {modeTabs.map((tab) => (
                <DropdownMenuItem key={tab.value} onClick={() => onSurfaceChange(tab.value)}>
                  {tab.value === "visual"
                    ? LL.panels.tools.visual()
                    : tab.value === "text"
                      ? LL.panels.tools.text()
                      : tab.value === "developer"
                        ? LL.panels.tools.developer()
                        : LL.panels.tools.preview()}
                  {tab.shortcut && <DropdownMenuShortcut>{tab.shortcut}</DropdownMenuShortcut>}
                </DropdownMenuItem>
              ))}

              {/* 2. Frame Size Submenu (Mobile & Desktop Sizes) */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Maximize2 />
                  {LL.menu.frameSize()}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="min-w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>{LL.menu.mobileCategory()}</DropdownMenuLabel>
                      {mobilePresets.map((preset) => {
                        const isActive =
                          currentWidth === preset.width && currentHeight === preset.height;
                        return (
                          <DropdownMenuItem
                            key={preset.id}
                            onClick={() =>
                              onPatchViewport?.({
                                selectedDeviceId: preset.id,
                                currentDeviceWidth: preset.width,
                                currentDeviceHeight: preset.height,
                              })
                            }
                          >
                            <Smartphone />
                            <span>{preset.name}</span>
                            <span className="ms-auto font-mono text-[10px] text-muted-foreground">
                              {preset.width}×{preset.height}
                            </span>
                            {isActive && <span className="ms-1 text-xs">✓</span>}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>{LL.menu.tabletCategory()}</DropdownMenuLabel>
                      {tabletPresets.map((preset) => {
                        const isActive =
                          currentWidth === preset.width && currentHeight === preset.height;
                        return (
                          <DropdownMenuItem
                            key={preset.id}
                            onClick={() =>
                              onPatchViewport?.({
                                selectedDeviceId: preset.id,
                                currentDeviceWidth: preset.width,
                                currentDeviceHeight: preset.height,
                              })
                            }
                          >
                            <Tablet />
                            <span>{preset.name}</span>
                            <span className="ms-auto font-mono text-[10px] text-muted-foreground">
                              {preset.width}×{preset.height}
                            </span>
                            {isActive && <span className="ms-1 text-xs">✓</span>}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>{LL.menu.desktopCategory()}</DropdownMenuLabel>
                      {desktopPresets.map((preset) => {
                        const isActive =
                          currentWidth === preset.width && currentHeight === preset.height;
                        return (
                          <DropdownMenuItem
                            key={preset.id}
                            onClick={() =>
                              onPatchViewport?.({
                                selectedDeviceId: preset.id,
                                currentDeviceWidth: preset.width,
                                currentDeviceHeight: preset.height,
                              })
                            }
                          >
                            <Laptop />
                            <span>{preset.name}</span>
                            <span className="ms-auto font-mono text-[10px] text-muted-foreground">
                              {preset.width}×{preset.height}
                            </span>
                            {isActive && <span className="ms-1 text-xs">✓</span>}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              {/* 3. Orientation Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <RotateCcw />
                  {LL.menu.orientation()}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="min-w-44">
                    <DropdownMenuItem onClick={() => onPatchViewport?.({ isRotated: false })}>
                      <span>{LL.menu.portrait()}</span>
                      {!isRotated && <span className="ms-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPatchViewport?.({ isRotated: true })}>
                      <span>{LL.menu.landscape()}</span>
                      {isRotated && <span className="ms-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onPatchViewport?.({ isRotated: !isRotated })}>
                      {LL.menu.rotateOrientation()}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              {/* 4. Zoom Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ZoomIn />
                  {LL.menu.zoomRatio({ percent: Math.round(currentZoom * 100) })}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="min-w-44">
                    <DropdownMenuItem
                      onClick={() => onPatchViewport?.({ zoom: Math.min(currentZoom + 0.1, 5) })}
                    >
                      {LL.menu.zoomIn()}
                      <DropdownMenuShortcut>⌘+</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onPatchViewport?.({ zoom: Math.max(currentZoom - 0.1, 0.1) })}
                    >
                      {LL.menu.zoomOut()}
                      <DropdownMenuShortcut>⌘-</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPatchViewport?.({ zoom: 1 })}>
                      {LL.menu.zoom100()}
                      <DropdownMenuShortcut>⌘0</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {zoomLevels.map((level) => {
                      const isActive = Math.abs(level - currentZoom) < 0.001;
                      return (
                        <DropdownMenuItem
                          key={level}
                          onClick={() => onPatchViewport?.({ zoom: level })}
                        >
                          {Math.round(level * 100)}%
                          {isActive && <span className="ms-auto text-xs">✓</span>}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onTogglePanel}>
                <PanelLeft />
                {panelCollapsed ? LL.menu.expandSidebar() : LL.menu.collapseSidebar()}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* Preferences Submenu (Figma style) */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{LL.menu.preferences()}</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="min-w-44">
              {/* Theme Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Sun />
                  {LL.menu.theme()}
                </DropdownMenuSubTrigger>
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

              {/* Language Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Languages />
                  {LL.menu.language()}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => useQueryStore.getState().setLocale("zh-CN")}>
                      {LL.menu.chinese()}
                      {locale === "zh-CN" && <span className="ms-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => useQueryStore.getState().setLocale("en-US")}>
                      {LL.menu.english()}
                      {locale === "en-US" && <span className="ms-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
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
