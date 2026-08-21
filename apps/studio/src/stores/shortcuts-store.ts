import { create } from "zustand";

export type ShortcutCategory =
  | "Essential"
  | "Tools"
  | "View"
  | "Zoom"
  | "Text"
  | "Shape"
  | "Selection"
  | "Cursor"
  | "Edit"
  | "Transform"
  | "Arrange"
  | "Components"
  | "Layout";

export interface ShortcutItem {
  id: string;
  category: ShortcutCategory;
  name: string;
  nameEn: string;
  keys: string[];
}

export const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  "Essential",
  "Tools",
  "View",
  "Zoom",
  "Text",
  "Shape",
  "Selection",
  "Cursor",
  "Edit",
  "Transform",
  "Arrange",
  "Components",
  "Layout",
];

export const REGISTERED_SHORTCUTS: ShortcutItem[] = [
  // 1. Essential
  {
    id: "doc.save",
    category: "Essential",
    name: "保存文档",
    nameEn: "Save document",
    keys: ["Mod", "S"],
  },
  {
    id: "doc.copyJson",
    category: "Essential",
    name: "复制 JSON 快照",
    nameEn: "Copy JSON snapshot",
    keys: ["Mod", "C"],
  },
  {
    id: "shortcuts.toggle",
    category: "Essential",
    name: "打开/关闭快捷键面板",
    nameEn: "Toggle shortcuts panel",
    keys: ["Mod", "/"],
  },
  {
    id: "theme.toggle",
    category: "Essential",
    name: "切换深浅主题",
    nameEn: "Toggle dark/light theme",
    keys: ["D"],
  },
  {
    id: "node.deselect",
    category: "Essential",
    name: "取消选择 / 关闭弹窗",
    nameEn: "Deselect / Close dialog",
    keys: ["Esc"],
  },

  // 2. Tools (Image #1 references)
  { id: "tool.select", category: "Tools", name: "移动/选择工具", nameEn: "Move tool", keys: ["V"] },
  { id: "tool.frame", category: "Tools", name: "框架工具", nameEn: "Frame tool", keys: ["F"] },
  { id: "tool.pen", category: "Tools", name: "钢笔工具", nameEn: "Pen tool", keys: ["P"] },
  {
    id: "tool.pencil",
    category: "Tools",
    name: "铅笔工具",
    nameEn: "Pencil tool",
    keys: ["Shift", "P"],
  },
  { id: "tool.text", category: "Tools", name: "文本工具", nameEn: "Text tool", keys: ["T"] },
  { id: "tool.rect", category: "Tools", name: "矩形工具", nameEn: "Rectangle tool", keys: ["R"] },
  { id: "tool.ellipse", category: "Tools", name: "椭圆工具", nameEn: "Ellipse tool", keys: ["O"] },
  { id: "tool.line", category: "Tools", name: "直线工具", nameEn: "Line tool", keys: ["L"] },
  {
    id: "tool.arrow",
    category: "Tools",
    name: "箭头工具",
    nameEn: "Arrow tool",
    keys: ["Shift", "L"],
  },
  {
    id: "tool.interact",
    category: "Tools",
    name: "交互工具",
    nameEn: "Interact tool",
    keys: ["I"],
  },
  { id: "tool.hand", category: "Tools", name: "平移抓手工具", nameEn: "Hand tool", keys: ["H"] },
  {
    id: "tool.comments",
    category: "Tools",
    name: "查看评论",
    nameEn: "View comments",
    keys: ["C"],
  },
  {
    id: "tool.pickColor",
    category: "Tools",
    name: "吸管取色",
    nameEn: "Pick color",
    keys: ["Ctrl", "C"],
  },
  { id: "tool.slice", category: "Tools", name: "切片工具", nameEn: "Slice tool", keys: ["S"] },

  // 3. View
  {
    id: "surface.visual",
    category: "View",
    name: "可视化编辑模式",
    nameEn: "Visual editor mode",
    keys: ["Mod", "1"],
  },
  {
    id: "surface.text",
    category: "View",
    name: "文档编辑模式",
    nameEn: "Document edit mode",
    keys: ["Mod", "2"],
  },
  {
    id: "surface.developer",
    category: "View",
    name: "开发者模式",
    nameEn: "Developer mode",
    keys: ["Mod", "3"],
  },
  {
    id: "ui.toggleSidebar",
    category: "View",
    name: "切换侧边大纲面板",
    nameEn: "Toggle left sidebar",
    keys: ["Mod", "E"],
  },
  {
    id: "ui.toggleProperties",
    category: "View",
    name: "切换右侧属性面板",
    nameEn: "Toggle properties panel",
    keys: ["Alt", "Mod", "P"],
  },
  {
    id: "viewport.rotate",
    category: "View",
    name: "旋转设备方向",
    nameEn: "Rotate device orientation",
    keys: ["Shift", "Mod", "R"],
  },

  // 4. Zoom
  { id: "zoom.in", category: "Zoom", name: "放大画布", nameEn: "Zoom in", keys: ["Mod", "+"] },
  { id: "zoom.out", category: "Zoom", name: "缩小画布", nameEn: "Zoom out", keys: ["Mod", "-"] },
  {
    id: "zoom.100",
    category: "Zoom",
    name: "缩放到 100%",
    nameEn: "Zoom to 100%",
    keys: ["Mod", "0"],
  },
  {
    id: "zoom.fit",
    category: "Zoom",
    name: "适应窗口大小",
    nameEn: "Zoom to fit",
    keys: ["Shift", "1"],
  },
  {
    id: "zoom.selection",
    category: "Zoom",
    name: "缩放至选区",
    nameEn: "Zoom to selection",
    keys: ["Shift", "2"],
  },

  // 5. Text
  { id: "text.bold", category: "Text", name: "加粗", nameEn: "Bold", keys: ["Mod", "B"] },
  { id: "text.italic", category: "Text", name: "斜体", nameEn: "Italic", keys: ["Mod", "I"] },
  {
    id: "text.underline",
    category: "Text",
    name: "下划线",
    nameEn: "Underline",
    keys: ["Mod", "U"],
  },
  {
    id: "text.alignLeft",
    category: "Text",
    name: "左对齐",
    nameEn: "Align left",
    keys: ["Alt", "Mod", "L"],
  },
  {
    id: "text.alignCenter",
    category: "Text",
    name: "居中对齐",
    nameEn: "Align center",
    keys: ["Alt", "Mod", "T"],
  },

  // 6. Shape
  {
    id: "shape.flipH",
    category: "Shape",
    name: "水平翻转",
    nameEn: "Flip horizontal",
    keys: ["Shift", "H"],
  },
  {
    id: "shape.flipV",
    category: "Shape",
    name: "垂直翻转",
    nameEn: "Flip vertical",
    keys: ["Shift", "V"],
  },
  {
    id: "shape.mask",
    category: "Shape",
    name: "创建蒙版",
    nameEn: "Use as mask",
    keys: ["Ctrl", "Mod", "M"],
  },

  // 7. Selection
  {
    id: "select.all",
    category: "Selection",
    name: "全选所有节点",
    nameEn: "Select all",
    keys: ["Mod", "A"],
  },
  {
    id: "select.parent",
    category: "Selection",
    name: "选择父级",
    nameEn: "Select parent",
    keys: ["Shift", "Enter"],
  },
  {
    id: "select.child",
    category: "Selection",
    name: "选择子级",
    nameEn: "Select child",
    keys: ["Enter"],
  },
  {
    id: "select.next",
    category: "Selection",
    name: "选择下一个同级",
    nameEn: "Select next sibling",
    keys: ["Tab"],
  },

  // 8. Cursor
  {
    id: "cursor.measure",
    category: "Cursor",
    name: "测量间距",
    nameEn: "Measure distances",
    keys: ["Alt"],
  },
  {
    id: "cursor.deepSelect",
    category: "Cursor",
    name: "深度穿透选择",
    nameEn: "Deep select",
    keys: ["Mod", "Click"],
  },

  // 9. Edit
  { id: "edit.undo", category: "Edit", name: "撤销", nameEn: "Undo", keys: ["Mod", "Z"] },
  { id: "edit.redo", category: "Edit", name: "重做", nameEn: "Redo", keys: ["Shift", "Mod", "Z"] },
  {
    id: "edit.duplicate",
    category: "Edit",
    name: "创建副本",
    nameEn: "Duplicate",
    keys: ["Mod", "D"],
  },
  { id: "edit.copy", category: "Edit", name: "复制", nameEn: "Copy", keys: ["Mod", "C"] },
  { id: "edit.paste", category: "Edit", name: "粘贴", nameEn: "Paste", keys: ["Mod", "V"] },
  { id: "edit.delete", category: "Edit", name: "删除", nameEn: "Delete", keys: ["Backspace"] },

  // 10. Transform
  { id: "transform.scale", category: "Transform", name: "缩放", nameEn: "Scale tool", keys: ["K"] },
  {
    id: "transform.rotate90",
    category: "Transform",
    name: "旋转 90 度",
    nameEn: "Rotate 90°",
    keys: ["Shift", "Mod", "R"],
  },

  // 11. Arrange
  {
    id: "arrange.front",
    category: "Arrange",
    name: "置于顶层",
    nameEn: "Bring to front",
    keys: ["]"],
  },
  {
    id: "arrange.back",
    category: "Arrange",
    name: "置于底层",
    nameEn: "Send to back",
    keys: ["["],
  },
  {
    id: "arrange.forward",
    category: "Arrange",
    name: "上移一层",
    nameEn: "Bring forward",
    keys: ["Mod", "]"],
  },
  {
    id: "arrange.backward",
    category: "Arrange",
    name: "下移一层",
    nameEn: "Send backward",
    keys: ["Mod", "["],
  },

  // 12. Components
  {
    id: "comp.create",
    category: "Components",
    name: "创建组件",
    nameEn: "Create component",
    keys: ["Alt", "Mod", "K"],
  },
  {
    id: "comp.detach",
    category: "Components",
    name: "分离实例",
    nameEn: "Detach instance",
    keys: ["Alt", "Mod", "B"],
  },

  // 13. Layout
  {
    id: "layout.autoAdd",
    category: "Layout",
    name: "添加自动布局",
    nameEn: "Add auto layout",
    keys: ["Shift", "A"],
  },
  {
    id: "layout.autoRemove",
    category: "Layout",
    name: "移除自动布局",
    nameEn: "Remove auto layout",
    keys: ["Alt", "Shift", "A"],
  },
];

interface ShortcutsState {
  isPanelOpen: boolean;
  activeCategory: ShortcutCategory;

  openPanel: (category?: ShortcutCategory) => void;
  closePanel: () => void;
  togglePanel: () => void;
  setActiveCategory: (category: ShortcutCategory) => void;
  getShortcutsByCategory: (category: ShortcutCategory) => ShortcutItem[];
}

export const useShortcutsStore = create<ShortcutsState>()((set) => ({
  isPanelOpen: false,
  activeCategory: "Tools",

  openPanel: (category) => {
    set({
      isPanelOpen: true,
      ...(category ? { activeCategory: category } : {}),
    });
  },

  closePanel: () => set({ isPanelOpen: false }),

  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),

  setActiveCategory: (activeCategory) => set({ activeCategory }),

  getShortcutsByCategory: (category) => {
    return REGISTERED_SHORTCUTS.filter((s) => s.category === category);
  },
}));
