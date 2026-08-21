import {
  Briefcase,
  Code2,
  Eye,
  FileText,
  Hexagon,
  PlusCircle,
  Sparkles,
  SquareMousePointer,
  type LucideIcon,
} from "lucide-react";

import type { AppDocument } from "@/core/document";
import type { Surface, ViewportState } from "@/core/editor-state";
import type { AdapterRegistry } from "@/core/registry";
import type { StudioBootstrap } from "@/core/studio-bootstrap";

export type SidebarTab = "file" | "agents" | "assets" | "tools" | "variables";

export interface ComponentItem {
  type: string;
  title: string;
  category?: string;
}

export interface DevicePreset {
  id: string;
  name: string;
  category: "mobile" | "tablet" | "desktop";
  width: number;
  height: number;
}

export const devicePresets: DevicePreset[] = [
  // Mobile Presets
  { id: "iphone-16-pro", name: "iPhone 16 Pro", category: "mobile", width: 393, height: 852 },
  {
    id: "iphone-16-pro-max",
    name: "iPhone 16 Pro Max",
    category: "mobile",
    width: 440,
    height: 956,
  },
  { id: "iphone-15", name: "iPhone 14 / 15", category: "mobile", width: 390, height: 844 },
  { id: "pixel-7", name: "Google Pixel 7", category: "mobile", width: 412, height: 915 },

  // Tablet Presets
  { id: "ipad-pro-11", name: 'iPad Pro 11"', category: "tablet", width: 834, height: 1194 },

  // Desktop Presets
  { id: "macbook-air-14", name: 'MacBook Air 14"', category: "desktop", width: 1280, height: 832 },
  { id: "macbook-pro-16", name: 'MacBook Pro 16"', category: "desktop", width: 1440, height: 900 },
  {
    id: "desktop-fhd",
    name: "Desktop (1920×1080)",
    category: "desktop",
    width: 1920,
    height: 1080,
  },
  {
    id: "desktop-compact",
    name: "Desktop (1280×720)",
    category: "desktop",
    width: 1280,
    height: 720,
  },
];

export interface StudioSidebarProps {
  bootstrap: StudioBootstrap;
  document: AppDocument;
  registry: AdapterRegistry;
  selectedId: string;
  surface: Surface;
  revision: number;
  valid: boolean;
  locale: string;
  locales: string[];
  manifestVersion: string;
  components: ComponentItem[];
  diagnostics: Array<{ message: string }>;
  pastLength: number;
  futureLength: number;
  viewport?: ViewportState;
  onPatchViewport?: (patch: Partial<ViewportState>) => void;
  addType: string;
  onSetAddType: (type: string) => void;
  onAddComponent: () => void;
  onSelectNode: (nodeId: string | null) => void;
  onSurfaceChange: (surface: Surface) => void;
  onLocaleChange: (locale: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopyJson: () => void;
  onSave: () => void;
}

export const navTabs: Array<{ id: SidebarTab; label: string; icon: LucideIcon }> = [
  { id: "file", label: "File", icon: FileText },
  { id: "agents", label: "Agents", icon: Sparkles },
  { id: "assets", label: "Assets", icon: PlusCircle },
  { id: "tools", label: "Tools", icon: Briefcase },
  { id: "variables", label: "Variables", icon: Hexagon },
];

export const modeTabs: Array<{
  value: Surface;
  label: string;
  shortcut: string;
  icon: LucideIcon;
}> = [
  { value: "visual", label: "可视化编辑模式", shortcut: "⌘1", icon: SquareMousePointer },
  { value: "text", label: "文档编辑模式", shortcut: "⌘2", icon: FileText },
  { value: "developer", label: "开发者模式", shortcut: "⌘3", icon: Code2 },
  { value: "preview", label: "预览模式", shortcut: "", icon: Eye },
];
