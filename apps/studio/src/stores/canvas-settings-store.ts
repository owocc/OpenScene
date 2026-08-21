import { create } from "zustand";

import { loadServerSettings, saveServerSettings } from "./settings-storage";

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

  setShowBackgroundPattern: (show: boolean) => void;
  setBackgroundTexture: (texture: BackgroundTexture) => void;
  openSettings: () => void;
  closeSettings: () => void;
}

const persisted = loadServerSettings();

export const useCanvasSettingsStore = create<CanvasSettingsState>()((set) => ({
  showBackgroundPattern: persisted.showBackgroundPattern ?? true,
  backgroundTexture: persisted.backgroundTexture ?? "dots",
  isSettingsOpen: false,

  setShowBackgroundPattern: (showBackgroundPattern) => {
    set({ showBackgroundPattern });
    saveServerSettings({ showBackgroundPattern });
  },
  setBackgroundTexture: (backgroundTexture) => {
    set({ backgroundTexture });
    saveServerSettings({ backgroundTexture });
  },
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
}));
