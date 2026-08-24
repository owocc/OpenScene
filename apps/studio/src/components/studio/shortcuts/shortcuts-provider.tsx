import { useEffect, useRef, type ReactNode } from "react";

import type { ActiveToolMode } from "@/core/editor-state";
import { useQueryStore } from "@/stores/query-store";
import { useShortcutsStore } from "@/stores/shortcuts-store";

export interface ShortcutsProviderProps {
  children?: ReactNode;
  onSave?: () => void;
  onCopyJson?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDeselect?: () => void;
  onDelete?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoom100?: () => void;
  onResetViewport?: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function ShortcutsProvider({
  children,
  onSave,
  onCopyJson,
  onUndo,
  onRedo,
  onDeselect,
  onDelete,
  onZoomIn,
  onZoomOut,
  onZoom100,
  onResetViewport,
}: ShortcutsProviderProps) {
  const temporaryToolRef = useRef<ActiveToolMode | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isEditing = isEditableTarget(event.target);
      const modifier = event.metaKey || event.ctrlKey;

      // 1. Escape key (always works)
      if (event.key === "Escape") {
        if (useShortcutsStore.getState().isPanelOpen) {
          event.preventDefault();
          useShortcutsStore.getState().closePanel();
          return;
        }
        if (!isEditing) {
          event.preventDefault();
          onDeselect?.();
          return;
        }
      }

      // 2. Toggle Shortcuts Panel (? key, ignored while typing)
      if (!isEditing && !modifier && !event.repeat && event.key === "?") {
        event.preventDefault();
        useShortcutsStore.getState().togglePanel();
        return;
      }

      // If user is typing in an input/textarea, ignore normal editor shortcuts
      if (isEditing) return;

      // 3. Delete / Backspace: Delete currently selected node
      if (!event.altKey && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        onDelete?.();
        return;
      }

      // 4. Document operations
      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSave?.();
        return;
      }

      // 5. History Undo / Redo
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
        return;
      }

      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        onRedo?.();
        return;
      }

      // 6. Surface Mode Switcher (Cmd+1 Visual, Cmd+2 Document, Cmd+3 Developer)
      if (modifier && event.key === "1") {
        event.preventDefault();
        useQueryStore.getState().setSurface("visual");
        return;
      }
      if (modifier && event.key === "2") {
        event.preventDefault();
        useQueryStore.getState().setSurface("text");
        return;
      }
      if (modifier && event.key === "3") {
        event.preventDefault();
        useQueryStore.getState().setSurface("developer");
        return;
      }

      // 7. View & Sidebar Toggles
      if (modifier && event.key.toLowerCase() === "e") {
        event.preventDefault();
        const current = useQueryStore.getState().sidebarCollapsed;
        useQueryStore.getState().setSidebarCollapsed(!current);
        return;
      }
      if (event.shiftKey && modifier && event.key.toLowerCase() === "r") {
        event.preventDefault();
        const rotated = useQueryStore.getState().rotated;
        useQueryStore.getState().setRotated(!rotated);
        return;
      }

      // 8. Canvas Zoom (Cmd + +, Cmd + -, Cmd + 0)
      if (modifier && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        onZoomIn?.();
        return;
      }
      if (modifier && (event.key === "-" || event.key === "_")) {
        event.preventDefault();
        onZoomOut?.();
        return;
      }
      if (modifier && event.key === "0") {
        event.preventDefault();
        onZoom100?.();
        return;
      }

      // 9. Spacebar Pan Mode
      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        const currentTool = useQueryStore.getState().tool;
        temporaryToolRef.current = currentTool;
        useQueryStore.getState().setTool("hand");
        return;
      }

      // 10. Single Key Tool Switcher
      if (!modifier && !event.altKey && !event.shiftKey) {
        const key = event.key.toLowerCase();
        if (key === "v") {
          event.preventDefault();
          useQueryStore.getState().setTool("select");
        } else if (key === "i") {
          event.preventDefault();
          useQueryStore.getState().setTool("interact");
        } else if (key === "h") {
          event.preventDefault();
          useQueryStore.getState().setTool("hand");
        } else if (key === "0") {
          event.preventDefault();
          onResetViewport?.();
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space" && temporaryToolRef.current) {
        useQueryStore.getState().setTool(temporaryToolRef.current);
        temporaryToolRef.current = null;
      }
    };

    const handleBlur = () => {
      if (temporaryToolRef.current) {
        useQueryStore.getState().setTool(temporaryToolRef.current);
        temporaryToolRef.current = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [
    onSave,
    onCopyJson,
    onUndo,
    onRedo,
    onDeselect,
    onDelete,
    onZoomIn,
    onZoomOut,
    onZoom100,
    onResetViewport,
  ]);

  return <>{children}</>;
}
