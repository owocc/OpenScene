import { create } from "zustand";

import { saveAppViewSettings } from "./settings-storage";
import { useQueryStore } from "./query-store";
import type { StudioViewSettings } from "./settings-storage";

/**
 * Canvas texture rendered behind the artboard when the pattern is shown.
 * Extend this union when adding new textures (e.g. "cross", "hex").
 */
export type BackgroundTexture = "dots" | "grid";

export const BACKGROUND_TEXTURES: readonly BackgroundTexture[] = ["dots", "grid"];

interface CanvasSettingsState {
  /** Whether the canvas editing area renders the background texture. */
  showBackgroundPattern: boolean;
  /** Which texture is rendered when the pattern is shown. */
  backgroundTexture: BackgroundTexture;
  isSettingsOpen: boolean;

  /** Applies persisted per-app view settings (called after bootstrap). */
  applyPersisted: (view: StudioViewSettings) => void;
  setShowBackgroundPattern: (show: boolean) => void;
  setBackgroundTexture: (texture: BackgroundTexture) => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useCanvasSettingsStore = create<CanvasSettingsState>()((set) => ({
  showBackgroundPattern: true,
  backgroundTexture: "dots",
  isSettingsOpen: false,

  applyPersisted: (view) =>
    set({
      showBackgroundPattern: view.showBackgroundPattern ?? true,
      backgroundTexture: view.backgroundTexture ?? "dots",
    }),

  setShowBackgroundPattern: (showBackgroundPattern) => {
    set({ showBackgroundPattern });
    const appId = useQueryStore.getState().appId;
    if (appId) saveAppViewSettings(appId, { showBackgroundPattern });
  },
  setBackgroundTexture: (backgroundTexture) => {
    set({ backgroundTexture });
    const appId = useQueryStore.getState().appId;
    if (appId) saveAppViewSettings(appId, { backgroundTexture });
  },
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
}));
