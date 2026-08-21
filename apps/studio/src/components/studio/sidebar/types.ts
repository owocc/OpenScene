import {
  Briefcase,
  Code2,
  Eye,
  FileText,
  Hexagon,
  PlusCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { AppDocument } from "@/core/document";
import type { Surface } from "@/core/editor-state";
import type { AdapterRegistry } from "@/core/registry";
import type { StudioBootstrap } from "@/core/studio-bootstrap";

export type SidebarTab = "file" | "agents" | "assets" | "tools" | "variables";

export interface ComponentItem {
  type: string;
  title: string;
  category?: string;
}

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
  { value: "developer", label: "开发者模式", shortcut: "⌘1", icon: Code2 },
  { value: "preview", label: "预览模式", shortcut: "⌘2", icon: Eye },
  { value: "text", label: "文档编辑模式", shortcut: "⌘3", icon: FileText },
];
