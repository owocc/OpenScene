import { useMemo } from "react";
import { Component, CornerDownRight, FileText, SquareDashed } from "lucide-react";
import {
  dragAndDropFeature,
  hotkeysCoreFeature,
  syncDataLoaderFeature,
  type DragTarget,
  type ItemInstance,
} from "@headless-tree/core";
import { COMPONENT_DRAG_MIME } from "@openscene-ai/core";
import { useTree } from "@headless-tree/react";

import { Tree, TreeDragLine, TreeItem, TreeItemLabel } from "@/components/reui/tree";
import { useI18n } from "@/i18n";
import type { SceneDocument } from "@openscene-ai/core";
import type { AdapterRegistry } from "@/core/registry";
import { buildPageTreeItems, type SidebarTreeItem } from "@/core/slot-tree";
import { cn } from "@/lib/utils";

interface PagesPanelProps {
  title: string;
  document: SceneDocument;
  registry: AdapterRegistry;
  selectedId: string;
  hoverNodeId?: string | null;
  onSelectNode: (nodeId: string | null, options?: { centerInView?: boolean }) => void;
  onReorder: (elementId: string, parentId: string, index?: number) => void;
  /** Insert a new component; optional drop target from tree drag-and-drop. */
  onAddComponent: (type: string, target?: { parentId: string; index?: number }) => void;
}

function folderIds(items: Record<string, SidebarTreeItem> | null): string[] {
  if (!items) return [];
  return Object.values(items)
    .filter((item) => (item.children?.length ?? 0) > 0)
    .map((item) => item.id);
}

/**
 * Structural signature: includes children order and slot contents so any
 * reorder/move remounts the tree, while pure prop edits keep it mounted.
 */
function structureSignature(document: SceneDocument): string {
  const entries = Object.entries(document.spec.elements)
    .map(([id, element]) => {
      const children = (element.children ?? []).join(",");
      const slots = Object.entries(element.slots ?? {})
        .map(([name, ids]) => `${name}:${ids.join(",")}`)
        .join("|");
      return `${id}->${children}${slots ? `[${slots}]` : ""}`;
    })
    .sort()
    .join(";");
  return `${document.spec.root}|${entries}`;
}

/**
 * Virtual tree root above the scene root. headless-tree always renders the
 * root item's children (its root cannot be collapsed), so the real scene root
 * is mounted one level below this virtual node and folds like any other
 * folder.
 */
const VIRTUAL_ROOT = "__document__";

function DocumentTree({
  document,
  registry,
  selectedId,
  hoverNodeId,
  onSelectNode,
  onReorder,
  onAddComponent,
}: {
  document: SceneDocument;
  registry: AdapterRegistry;
  selectedId: string;
  hoverNodeId?: string | null;
  onSelectNode: (nodeId: string | null, options?: { centerInView?: boolean }) => void;
  onReorder: (elementId: string, parentId: string, index?: number) => void;
  onAddComponent: (type: string, target?: { parentId: string; index?: number }) => void;
}) {
  const treeData = useMemo(
    () => buildPageTreeItems(document, (type) => registry.getComponent(type)),
    [document, registry],
  );
  const sceneRoot = document.spec.root;

  const tree = useTree<SidebarTreeItem>({
    rootItemId: VIRTUAL_ROOT,
    getItemName: (item) => item.getItemData().label,
    isItemFolder: (item) => (item.getItemData().children?.length ?? 0) > 0,
    dataLoader: {
      getItem: (itemId) =>
        itemId === VIRTUAL_ROOT
          ? {
              id: VIRTUAL_ROOT,
              label: "Document",
              kind: "element",
              children: sceneRoot ? [sceneRoot] : [],
            }
          : (treeData?.[itemId] ?? { id: itemId, label: itemId, kind: "element" }),
      getChildren: (itemId) =>
        itemId === VIRTUAL_ROOT
          ? sceneRoot && treeData?.[sceneRoot]
            ? [sceneRoot]
            : []
          : (treeData?.[itemId]?.children ?? []),
    },
    // Everything starts expanded so the full hierarchy (children + slots) is
    // visible; collapsing is fully managed by the tree (uncontrolled).
    initialState: {
      expandedItems: [VIRTUAL_ROOT, ...folderIds(treeData)],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature, dragAndDropFeature],
    // Allow dropping into any element (not just folders): the middle zone of a
    // row makes it a child (appended), the top/bottom zones reorder siblings.
    canDrop: () => true,
    // Accept component cards dragged from the Actions panel: drop creates the
    // node under the target item (appended, or positioned by insertionIndex).
    canDropForeignDragObject: (dataTransfer) => dataTransfer.types.includes(COMPONENT_DRAG_MIME),
    onDropForeignDragObject: (dataTransfer, target) => {
      const type =
        dataTransfer.getData(COMPONENT_DRAG_MIME) ??
        (window as unknown as Record<string, string | null>).__opensceneDraggingComponent;
      if (!type) return;
      const parentId = target.item.getId();
      if (parentId === VIRTUAL_ROOT) return;
      const index = "childIndex" in target ? target.insertionIndex : undefined;
      onAddComponent(type, { parentId, index });
    },
    onDrop: (items: ItemInstance<SidebarTreeItem>[], target: DragTarget<SidebarTreeItem>) => {
      const dragged = items[0];
      if (!dragged || dragged.getId() === VIRTUAL_ROOT) return;
      // `target.item` is the new parent; `insertionIndex` positions the item
      // within that parent's children (defaults to append when dropped on the
      // item itself).
      const parentId = target.item.getId();
      if (parentId === VIRTUAL_ROOT) return;
      const index = "childIndex" in target ? target.insertionIndex : undefined;
      onReorder(dragged.getId(), parentId, index);
    },
  });

  return (
    <Tree tree={tree} indent={16} toggleIconType="chevron" className="px-1">
      {tree.getItems().map((item) => {
        const data = item.getItemData();
        const isSlot = data.kind === "slot";
        const selected = !isSlot && selectedId === data.id;
        const hovered = !isSlot && hoverNodeId != null && hoverNodeId === data.id;
        return (
          <TreeItem key={item.getId()} item={item}>
            <TreeItemLabel
              className={cn(
                selected && "bg-accent text-accent-foreground",
                hovered && !selected && "bg-accent/40",
                isSlot && "text-muted-foreground",
              )}
              onClick={() => onSelectNode(data.id, { centerInView: true })}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {isSlot ? (
                  <CornerDownRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground/70"
                  />
                ) : data.hasContent ? (
                  <SquareDashed
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                ) : (
                  <Component
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                )}
                <span className="truncate">{data.label}</span>
                {!isSlot && (
                  <span className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground opacity-70">
                    {data.type}
                  </span>
                )}
              </span>
            </TreeItemLabel>
          </TreeItem>
        );
      })}
      <TreeDragLine />
    </Tree>
  );
}

export function PagesPanel({
  title,
  document,
  registry,
  selectedId,
  hoverNodeId,
  onSelectNode,
  onReorder,
  onAddComponent,
}: PagesPanelProps) {
  const { LL } = useI18n();
  const nodeCount = Object.keys(document.spec.elements).length;
  const hasRoot = document.spec.root != null && document.spec.root in document.spec.elements;

  return (
    <div className="flex flex-col p-2">
      {/* Pages Section */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-center justify-between px-2 text-[11px] font-semibold text-muted-foreground">
          <span>{LL.panels.pages.pages()}</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-[10px] text-muted-foreground/80">1</span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-accent/60 px-2.5 py-1.5 text-xs font-medium text-accent-foreground">
          <FileText className="size-3.5 text-primary" />
          <span className="truncate">{title}</span>
        </div>
      </div>

      {/* Layers / Nodes Section */}
      <div className="flex-1">
        <div className="mb-1.5 flex items-center justify-between px-2 text-[11px] font-semibold text-muted-foreground">
          <span>{LL.panels.pages.layers()}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {LL.panels.pages.nodeCount({ count: nodeCount })}
          </span>
        </div>

        {hasRoot ? (
          <DocumentTree
            key={structureSignature(document)}
            document={document}
            registry={registry}
            selectedId={selectedId}
            hoverNodeId={hoverNodeId}
            onSelectNode={onSelectNode}
            onReorder={onReorder}
            onAddComponent={onAddComponent}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
            {LL.panels.pages.emptyDoc()}
          </div>
        )}
      </div>
    </div>
  );
}
