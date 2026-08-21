import { create } from "zustand";

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

export const useCanvasSettingsStore = create<CanvasSettingsState>()((set) => ({
  showBackgroundPattern: true,
  backgroundTexture: "dots",
  isSettingsOpen: false,

  setShowBackgroundPattern: (showBackgroundPattern) => set({ showBackgroundPattern }),
  setBackgroundTexture: (backgroundTexture) => set({ backgroundTexture }),
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
}));
