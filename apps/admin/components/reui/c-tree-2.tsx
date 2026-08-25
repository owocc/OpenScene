"use client";

import {
  hotkeysCoreFeature,
  selectionFeature,
  syncDataLoaderFeature,
  type ItemInstance,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { Tree, TreeItem, TreeItemLabel } from "@/components/reui/tree";
import { cn } from "@/lib/utils";

export interface TreeDataItem<T = unknown> {
  id: string;
  name: string;
  children?: string[];
  data?: T;
}

export interface CTree2Props<T = unknown> {
  items: Record<string, TreeDataItem<T>>;
  rootItemId: string;
  selectedItemId?: string | null;
  onSelectItem?: (item: TreeDataItem<T>) => void;
  expandedItemIds?: string[];
  indent?: number;
  className?: string;
  renderItemLabel?: (item: ItemInstance<TreeDataItem<T>>) => React.ReactNode;
}

export function CTree2<T = unknown>({
  items,
  rootItemId,
  selectedItemId,
  onSelectItem,
  expandedItemIds,
  indent = 20,
  className,
  renderItemLabel,
}: CTree2Props<T>) {
  const tree = useTree<TreeDataItem<T>>({
    initialState: {
      expandedItems: expandedItemIds ?? [rootItemId],
      selectedItems: selectedItemId ? [selectedItemId] : [],
    },
    indent,
    rootItemId,
    getItemName: (item) => item.getItemData()?.name ?? item.getId(),
    isItemFolder: (item) => (item.getItemData()?.children?.length ?? 0) > 0,
    dataLoader: {
      getItem: (itemId) => items[itemId] ?? { id: itemId, name: itemId },
      getChildren: (itemId) => items[itemId]?.children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature, selectionFeature],
  });

  const visibleItems = tree.getItems();

  return (
    <div className={cn("relative w-full", className)}>
      <Tree
        className="relative before:absolute before:inset-0 before:-ms-1 before:pointer-events-none before:bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(var(--tree-indent)-1px),var(--color-kumo-line,rgba(128,128,128,0.2))_calc(var(--tree-indent)-1px),var(--color-kumo-line,rgba(128,128,128,0.2))_calc(var(--tree-indent)))]"
        indent={indent}
        tree={tree}
      >
        {visibleItems.map((item) => (
          <TreeItem
            key={item.getId()}
            item={item}
            onClick={() => {
              const data = item.getItemData();
              if (data && onSelectItem) {
                onSelectItem(data);
              }
            }}
          >
            {renderItemLabel ? (
              renderItemLabel(item)
            ) : (
              <TreeItemLabel item={item}>{item.getItemName()}</TreeItemLabel>
            )}
          </TreeItem>
        ))}
      </Tree>
    </div>
  );
}
