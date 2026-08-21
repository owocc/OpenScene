import type { ReactNode } from "react";

import type { AppDocument, AppElement, JsonValue } from "@/core/document";
import type { RuntimeAdapter, RuntimeRenderContext } from "@/adapters/shadcn";

interface PreviewCanvasProps {
  document: AppDocument;
  runtimeAdapters: RuntimeAdapter[];
  selectedId: string;
  locale: string;
  onSelect: (id: string) => void;
  viewportWidth: number;
}

function findRenderer(type: string, adapters: RuntimeAdapter[]) {
  for (const adapter of adapters) {
    const renderer = adapter.renderers[type];
    if (renderer) return renderer;
  }
  return undefined;
}

export function PreviewCanvas({
  document,
  runtimeAdapters,
  selectedId,
  locale,
  onSelect,
  viewportWidth,
}: PreviewCanvasProps) {
  const renderNode = (id: string): ReactNode => {
    const element: AppElement | undefined = document.spec.elements[id];
    if (!element) {
      return (
        <div
          key={id}
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
        >
          Missing element: {id}
        </div>
      );
    }

    const renderer = findRenderer(element.type, runtimeAdapters);
    if (!renderer) {
      return (
        <div
          key={id}
          className="rounded-lg border border-dashed border-destructive/50 bg-destructive/5 p-3 text-xs text-destructive"
        >
          No Adapter renderer for <code>{element.type}</code>
        </div>
      );
    }

    const context: RuntimeRenderContext = {
      id,
      element,
      document,
      selected: selectedId === id,
      children: (element.children ?? []).map((childId) => (
        <span key={childId}>{renderNode(childId)}</span>
      )),
      slots: Object.fromEntries(
        Object.entries(element.slots ?? {}).map(([slot, childIds]) => [
          slot,
          childIds.map((childId) => <span key={childId}>{renderNode(childId)}</span>),
        ]),
      ),
      resolve: (value: JsonValue | undefined) => {
        const adapter = runtimeAdapters[0];
        if (!adapter) return value;
        // Runtime resolution is deliberately shared by every renderer in this canvas.
        return adapter.resolve ? adapter.resolve(value, document, locale) : value;
      },
      onSelect,
    };

    return <div key={id}>{renderer(context)}</div>;
  };

  const root = document.spec.elements[document.spec.root];
  const designWidth = document.globalConfig.design.width ?? 1200;
  const width = Math.min(designWidth, viewportWidth);

  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-[radial-gradient(circle_at_top,#eef2ff_0%,#f5f6f8_40%,#e5e7eb_100%)] p-6 sm:p-10">
      <div
        className="relative h-fit min-h-full shrink-0 overflow-hidden rounded-2xl border border-border/80 bg-background shadow-xl shadow-slate-900/10 transition-[width]"
        style={{ width, maxWidth: "100%" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center">
          <div className="rounded-b-lg border-x border-b border-border bg-background/90 px-2.5 py-1 font-mono text-[9px] text-muted-foreground shadow-sm">
            {root?.name ?? "Page"} · {Math.round(width)}px
          </div>
        </div>
        <div className="min-h-full" onClick={() => onSelect(document.spec.root)}>
          {renderNode(document.spec.root)}
        </div>
      </div>
    </div>
  );
}
