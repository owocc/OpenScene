import { useState } from "react";
import { ChevronDown, ChevronRight, CircleDot, Layers3 } from "lucide-react";

import type { AppDocument, AppElement } from "@/core/document";
import type { AdapterRegistry } from "@/core/registry";
import { cn } from "@/lib/utils";

interface OutlineTreeProps {
  document: AppDocument;
  registry: AdapterRegistry;
  selectedId: string;
  onSelect: (id: string) => void;
}

function childGroups(element: AppElement) {
  return [
    { label: "children", ids: element.children ?? [], named: false },
    ...Object.entries(element.slots ?? {}).map(([label, ids]) => ({ label, ids, named: true })),
  ].filter((group) => group.ids.length > 0);
}

function TreeNode({
  id,
  document,
  registry,
  selectedId,
  onSelect,
  depth = 0,
}: OutlineTreeProps & { id: string; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const element = document.spec.elements[id];
  if (!element) return null;

  const meta = registry.getComponent(element.type);
  const groups = childGroups(element);
  const hasChildren = groups.length > 0;

  return (
    <div>
      <div
        className={cn(
          "group flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted",
          selectedId === id && "bg-primary/10 text-primary",
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
          onClick={() => onSelect(id)}
        >
          {element.type === "Container" ? (
            <Layers3 className="size-3.5 shrink-0 text-blue-500" />
          ) : (
            <CircleDot className="size-3 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate font-medium">
            {element.name || meta?.title || element.type}
          </span>
          <span className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {element.type}
          </span>
        </button>
      </div>
      {expanded && hasChildren && (
        <div>
          {groups.map((group) => (
            <div key={group.label}>
              {group.named && (
                <div className="py-1 pl-11 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  slot: {group.label}
                </div>
              )}
              {group.ids.map((childId) => (
                <TreeNode
                  key={childId}
                  id={childId}
                  document={document}
                  registry={registry}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  depth={depth + 1}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OutlineTree({ document, registry, selectedId, onSelect }: OutlineTreeProps) {
  return (
    <TreeNode
      id={document.spec.root}
      document={document}
      registry={registry}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
}
