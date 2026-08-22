import { useEffect, useMemo, useRef, useState } from "react";
import { Box, FileText, FolderOpen } from "lucide-react";
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";

import { Button } from "@/components/ui/button";
import { Tree, TreeItem, TreeItemLabel } from "@/components/reui/tree";
import { useI18n } from "@/i18n";
import type { SceneDocument } from "@openscene/protocol";
import type { AdapterRegistry } from "@/core/registry";
import type { ComponentMeta } from "@/core/meta";
import { buildTree, type TreeNode } from "@/core/slot-tree";
import { cn } from "@/lib/utils";

interface PagesPanelProps {
  title: string;
  document: SceneDocument;
  registry: AdapterRegistry;
  selectedId: string;
  components: ComponentMeta[];
  onAddComponent: (type: string) => void;
  onSelectNode: (nodeId: string | null) => void;
}

interface PageTreeItem {
  id: string;
  label: string;
  type?: string;
  kind: "element" | "slot";
  children?: string[];
}

function flattenTree(tree: TreeNode): Record<string, PageTreeItem> {
  const items: Record<string, PageTreeItem> = {};
  const visit = (node: TreeNode) => {
    items[node.id] = {
      id: node.id,
      label: node.label,
      type: node.kind === "element" ? node.type : undefined,
      kind: node.kind,
      children: node.children.map((child) => child.id),
    };
    node.children.forEach(visit);
  };
  visit(tree);
  return items;
}

export function PagesPanel({
  title,
  document,
  registry,
  selectedId,
  components,
  onAddComponent,
  onSelectNode,
}: PagesPanelProps) {
  const { LL } = useI18n();
  const [addType, setAddType] = useState("");
  const nodeCount = Object.keys(document.spec.elements).length;

  const treeData = useMemo(() => {
    const root = buildTree(document, (type) => registry.getComponent(type));
    return root ? flattenTree(root) : null;
  }, [document, registry]);

  const rootId = document.spec.root;
  const itemsRef = useRef(treeData);
  itemsRef.current = treeData;

  const tree = useTree<PageTreeItem>({
    rootItemId: rootId ?? "root",
    getItemName: (item) => item.getItemData().label,
    isItemFolder: (item) => (item.getItemData().children?.length ?? 0) > 0,
    dataLoader: {
      getItem: (itemId) =>
        itemsRef.current?.[itemId] ?? { id: itemId, label: itemId, kind: "element" },
      getChildren: (itemId) => itemsRef.current?.[itemId]?.children ?? [],
    },
    initialState: { expandedItems: rootId ? [rootId] : [] },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  useEffect(() => {
    if (treeData) tree.rebuildTree();
  }, [tree, treeData]);

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

        {document.spec.root && treeData ? (
          <Tree tree={tree} indent={16} toggleIconType="chevron" className="px-1">
            {[tree.getRootItem(), ...tree.getItems()].map((item) => {
              const data = item.getItemData();
              const isSlot = data.kind === "slot";
              const selected = !isSlot && selectedId === data.id;
              return (
                <TreeItem
                  key={item.getId()}
                  item={item}
                  indentOffset={item.getItemMeta().level === -1 ? 1 : 0}
                >
                  <TreeItemLabel
                    className={cn(
                      selected && "bg-accent text-accent-foreground",
                      isSlot && "text-muted-foreground",
                    )}
                    onClick={() => onSelectNode(data.id)}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {isSlot ? (
                        <FolderOpen
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-muted-foreground/70"
                        />
                      ) : (
                        <Box
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-muted-foreground"
                        />
                      )}
                      <span className={cn("truncate", isSlot && "text-xs")}>
                        {isSlot ? `slot: ${data.label}` : data.label}
                      </span>
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
          </Tree>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
            {LL.panels.pages.emptyDoc()}
          </div>
        )}
      </div>

      {/* Quick Add Node Bar */}
      <div className="mt-4 border-t border-border/80 pt-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {LL.panels.pages.addComponent()}
        </div>
        <div className="mt-2 flex gap-1.5">
          <select
            className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            value={addType}
            onChange={(event) => setAddType(event.target.value)}
            aria-label={LL.panels.pages.addComponent()}
          >
            <option value="">{LL.common.selectComponent()}</option>
            {components.map((component) => (
              <option key={component.type} value={component.type}>
                {component.title}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onAddComponent(addType);
              setAddType("");
            }}
            disabled={!addType}
          >
            {LL.common.add()}
          </Button>
        </div>
      </div>
    </div>
  );
}
