import { useState } from "react";
import { ChevronDown, ChevronRight, CircleDot, Layers3, PanelsTopLeft } from "lucide-react";

import type { AppDocument } from "@/core/document";
import type { AdapterRegistry } from "@/core/registry";
import type { TreeNode } from "@/core/slot-tree";
import { buildTree } from "@/core/slot-tree";
import { cn } from "@/lib/utils";

interface OutlineTreeProps {
  document: AppDocument;
  registry: AdapterRegistry;
  selectedId: string;
  onSelect: (id: string) => void;
}

function TreeNode({
  node,
  selectedId,
  onSelect,
  depth = 0,
}: Omit<OutlineTreeProps, "document" | "registry"> & { node: TreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  if (node.kind === "slot") {
    return (
      <div>
        <div
          className={cn(
            "group flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted",
            selectedId === node.id && "bg-primary/10 text-primary",
          )}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          <button
            className="grid size-5 shrink-0 place-items-center rounded-md hover:bg-background"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? "Collapse slot" : "Expand slot"}
          >
            {node.children.length > 0 ? (
              expanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )
            ) : (
              <span className="size-3.5" />
            )}
          </button>
          <button
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            onClick={() => onSelect(node.id)}
          >
            <PanelsTopLeft className="size-3.5 shrink-0" />
            <span className="truncate">slot: {node.label}</span>
            <span className="ml-auto font-mono text-[9px]">{node.children.length}</span>
          </button>
        </div>
        {node.children.length > 0 && expanded && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                selectedId={selectedId}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "group flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted",
          selectedId === node.id && "bg-primary/10 text-primary",
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <button
          className="grid size-5 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-background"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )
          ) : (
            <span className="size-3.5" />
          )}
        </button>
        <button
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => onSelect(node.id)}
        >
          {node.type === "Container" ? (
            <Layers3 className="size-3.5 shrink-0 text-blue-500" />
          ) : (
            <CircleDot className="size-3 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate font-medium">{node.label}</span>
          <span className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {node.type}
          </span>
        </button>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function OutlineTree({ document, registry, selectedId, onSelect }: OutlineTreeProps) {
  const tree = buildTree(document, (type) => registry.getComponent(type));
  if (!tree) return null;
  return <TreeNode node={tree} selectedId={selectedId} onSelect={onSelect} />;
}
