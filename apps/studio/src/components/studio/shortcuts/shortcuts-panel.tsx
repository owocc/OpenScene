import {
  ArrowRight,
  Circle,
  Code2,
  Component,
  Copy,
  Crop,
  Eye,
  Hand,
  Hash,
  LayoutGrid,
  MessageSquare,
  Minus,
  MousePointer2,
  MousePointerClick,
  Pen,
  Pencil,
  Pipette,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { SHORTCUT_CATEGORIES, useShortcutsStore } from "@/stores/shortcuts-store";
import { cn } from "@/lib/utils";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function formatKeyBadge(key: string): string {
  switch (key) {
    case "Mod":
      return isMac ? "⌘" : "Ctrl";
    case "Shift":
      return isMac ? "⇧" : "Shift";
    case "Alt":
      return isMac ? "⌥" : "Alt";
    case "Ctrl":
      return isMac ? "⌃" : "Ctrl";
    case "Enter":
      return "↵";
    case "Backspace":
      return isMac ? "⌫" : "Backspace";
    case "Delete":
      return "Delete";
    case "Escape":
    case "Esc":
      return "Esc";
    case "Space":
      return "Space";
    default:
      return key;
  }
}

function getShortcutIcon(id: string): LucideIcon {
  if (id.includes("select")) return MousePointer2;
  if (id.includes("frame")) return Hash;
  if (id.includes("pen")) return Pen;
  if (id.includes("pencil")) return Pencil;
  if (id.includes("text")) return Type;
  if (id.includes("rect")) return Square;
  if (id.includes("ellipse")) return Circle;
  if (id.includes("line")) return Minus;
  if (id.includes("arrow")) return ArrowRight;
  if (id.includes("interact")) return MousePointerClick;
  if (id.includes("hand")) return Hand;
  if (id.includes("comments")) return MessageSquare;
  if (id.includes("pickColor")) return Pipette;
  if (id.includes("slice")) return Crop;
  if (id.includes("save")) return Save;
  if (id.includes("copy")) return Copy;
  if (id.includes("undo")) return Undo2;
  if (id.includes("redo")) return Redo2;
  if (id.includes("delete")) return Trash2;
  if (id.includes("developer")) return Code2;
  if (id.includes("preview")) return Eye;
  if (id.includes("zoom.in")) return ZoomIn;
  if (id.includes("zoom.out")) return ZoomOut;
  if (id.includes("zoom")) return Search;
  if (id.includes("rotate")) return RotateCcw;
  if (id.includes("comp")) return Component;
  if (id.includes("layout")) return LayoutGrid;
  return Sparkles;
}

export function ShortcutsPanel() {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";

  const isPanelOpen = useShortcutsStore((s) => s.isPanelOpen);
  const activeCategory = useShortcutsStore((s) => s.activeCategory);
  const closePanel = useShortcutsStore((s) => s.closePanel);
  const setActiveCategory = useShortcutsStore((s) => s.setActiveCategory);
  const getShortcutsByCategory = useShortcutsStore((s) => s.getShortcutsByCategory);

  if (!isPanelOpen) return null;

  const currentShortcuts = getShortcutsByCategory(activeCategory);

  return (
    <div
      className="flex h-54 w-full flex-col select-none border-t border-border/80 bg-[#1e1e1e] text-zinc-100 shadow-2xl dark:bg-[#141416]"
      role="dialog"
      aria-label="Figma Keyboard Shortcuts Panel"
    >
      {/* 1. Top Horizontal Category Tabs */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto no-scrollbar">
          {SHORTCUT_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                className={cn(
                  "relative h-9 px-3 text-xs font-medium transition-colors hover:text-white focus-visible:outline-none",
                  isActive
                    ? "border-b-2 border-primary font-semibold text-white"
                    : "text-zinc-400 hover:text-zinc-200",
                )}
                onClick={() => setActiveCategory(cat)}
              >
                <span>{cat}</span>
              </button>
            );
          })}
        </div>

        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-7 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
          onClick={closePanel}
          aria-label="Close shortcuts panel"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* 2. Shortcuts Multi-Column Grid (Fixed remaining height) */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {currentShortcuts.map((item) => {
            const Icon = getShortcutIcon(item.id);
            const itemName = isZh ? item.name : item.nameEn;

            return (
              <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex min-w-0 items-center gap-2 text-zinc-300">
                  <Icon className="size-4 shrink-0 text-zinc-400" />
                  <span className="truncate">{itemName}</span>
                </div>

                {/* Keycaps */}
                <div className="flex shrink-0 items-center gap-1">
                  {item.keys.map((k, index) => {
                    const formatted = formatKeyBadge(k);
                    const isSingleChar = formatted.length === 1 && !/[⌘⇧⌥⌃↵]/.test(formatted);

                    return (
                      <span
                        key={index}
                        className={cn(
                          "inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-semibold select-none",
                          isSingleChar
                            ? "bg-[#0c8ce9] text-white shadow-xs"
                            : "border border-zinc-700 bg-zinc-800/90 text-zinc-200 shadow-xs",
                        )}
                      >
                        {formatted}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
