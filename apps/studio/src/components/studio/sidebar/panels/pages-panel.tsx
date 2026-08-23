import { useMemo, useState } from "react";
import { Component, CornerDownRight, FileText, SquareDashed } from "lucide-react";
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";

import { Button } from "@/components/ui/button";
import { Tree, TreeItem, TreeItemLabel } from "@/components/reui/tree";
import { useI18n } from "@/i18n";
import type { SceneDocument } from "@openscene/protocol";
import type { AdapterRegistry } from "@/core/registry";
import type { ComponentMeta } from "@/core/meta";
import { buildPageTreeItems, type SidebarTreeItem } from "@/core/slot-tree";
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

function folderIds(items: Record<string, SidebarTreeItem> | null): string[] {
  if (!items) return [];
  return Object.values(items)
    .filter((item) => (item.children?.length ?? 0) > 0)
    .map((item) => item.id);
}

/** Structural signature: remounts the tree only when the element set changes. */
function structureSignature(document: SceneDocument): string {
  return `${document.spec.root}|${Object.keys(document.spec.elements).sort().join(",")}`;
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
  onSelectNode,
}: {
  document: SceneDocument;
  registry: AdapterRegistry;
  selectedId: string;
  onSelectNode: (nodeId: string | null) => void;
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
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  return (
    <Tree tree={tree} indent={16} toggleIconType="chevron" className="px-1">
      {tree.getItems().map((item) => {
        const data = item.getItemData();
        const isSlot = data.kind === "slot";
        const selected = !isSlot && selectedId === data.id;
        return (
          <TreeItem key={item.getId()} item={item}>
            <TreeItemLabel
              className={cn(
                selected && "bg-accent text-accent-foreground",
                isSlot && "text-muted-foreground",
              )}
              onClick={() => onSelectNode(data.id)}
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
    </Tree>
  );
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
            onSelectNode={onSelectNode}
          />
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
