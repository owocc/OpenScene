import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OutlineTree } from "@/components/studio/outline-tree";
import { useI18n } from "@/i18n";
import type { SceneDocument } from "@openscene/protocol";
import type { AdapterRegistry } from "@/core/registry";
import type { ComponentItem } from "../types";

interface FilePanelProps {
  title: string;
  document: SceneDocument;
  registry: AdapterRegistry;
  selectedId: string;
  components: ComponentItem[];
  addType: string;
  onSetAddType: (type: string) => void;
  onAddComponent: () => void;
  onSelectNode: (nodeId: string | null) => void;
}

export function FilePanel({
  title,
  document,
  registry,
  selectedId,
  components,
  addType,
  onSetAddType,
  onAddComponent,
  onSelectNode,
}: FilePanelProps) {
  const { LL } = useI18n();
  const nodeCount = Object.keys(document.spec.elements).length;

  return (
    <div className="flex flex-col p-2">
      {/* Pages Section */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-center justify-between px-2 text-[11px] font-semibold text-muted-foreground">
          <span>{LL.panels.file.pages()}</span>
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
          <span>{LL.panels.file.layers()}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {LL.panels.file.nodeCount({ count: nodeCount })}
          </span>
        </div>

        {document.spec.root ? (
          <OutlineTree
            document={document}
            registry={registry}
            selectedId={selectedId}
            onSelect={onSelectNode}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
            {LL.panels.file.emptyDoc()}
          </div>
        )}
      </div>

      {/* Quick Add Node Bar */}
      <div className="mt-4 border-t border-border/80 pt-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {LL.panels.file.addComponent()}
        </div>
        <div className="mt-2 flex gap-1.5">
          <select
            className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            value={addType}
            onChange={(event) => onSetAddType(event.target.value)}
            aria-label={LL.panels.file.addComponent()}
          >
            <option value="">{LL.common.selectComponent()}</option>
            {components.map((component) => (
              <option key={component.type} value={component.type}>
                {component.title}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={onAddComponent} disabled={!addType}>
            {LL.common.add()}
          </Button>
        </div>
      </div>
    </div>
  );
}
