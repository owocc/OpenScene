import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  Eye,
  FileJson,
  FormInput,
  LayoutTemplate,
  Monitor,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Plus,
  Redo2,
  Search,
  Settings2,
  Sparkles,
  Tablet,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";

import { shadcnAdapter, type RuntimeAdapter } from "@/adapters/shadcn";
import { Button } from "@/components/ui/button";
import { OutlineTree } from "@/components/studio/outline-tree";
import { PreviewCanvas } from "@/components/studio/preview-canvas";
import { PropertyEditor } from "@/components/studio/property-editor";
import {
  createStarterDocument,
  isRecord,
  type AppDocument,
  type AppElement,
  validateAppDocument,
} from "@/core/document";
import { defaultProps } from "@/core/meta";
import { AdapterRegistry } from "@/core/registry";
import { cn } from "@/lib/utils";

const registry = new AdapterRegistry().register(shadcnAdapter.meta);
const runtimeAdapters: RuntimeAdapter[] = [shadcnAdapter];

const componentIcons = {
  Container: LayoutTemplate,
  Text: Type,
  Button: MousePointer2,
  Input: FormInput,
};

function findParent(document: AppDocument, targetId: string) {
  for (const [id, element] of Object.entries(document.spec.elements)) {
    if (element.children?.includes(targetId)) return id;
    if (Object.values(element.slots ?? {}).some((children) => children.includes(targetId)))
      return id;
  }
  return document.spec.root;
}

function collectDescendants(document: AppDocument, rootId: string) {
  const removed = new Set<string>();
  const visit = (id: string) => {
    if (removed.has(id)) return;
    removed.add(id);
    const element = document.spec.elements[id];
    if (!element) return;
    element.children?.forEach(visit);
    Object.values(element.slots ?? {})
      .flat()
      .forEach(visit);
  };
  visit(rootId);
  return removed;
}

function nextElementId(document: AppDocument, type: string) {
  const base = type.toLowerCase();
  let index = 1;
  while (`${base}-${index}` in document.spec.elements) index += 1;
  return `${base}-${index}`;
}

function componentLabel(type: string) {
  if (type === "Container") return "布局容器";
  if (type === "Text") return "文本";
  if (type === "Button") return "按钮";
  if (type === "Input") return "输入框";
  return type;
}

export function App() {
  const [document, setDocument] = useState<AppDocument>(() => createStarterDocument());
  const [selectedId, setSelectedId] = useState("hero");
  const [past, setPast] = useState<AppDocument[]>([]);
  const [future, setFuture] = useState<AppDocument[]>([]);
  const [revision, setRevision] = useState(1);
  const [locale, setLocale] = useState("en-US");
  const [viewport, setViewport] = useState<"desktop" | "tablet">("desktop");
  const [surface, setSurface] = useState<"canvas" | "json">("canvas");
  const [componentSearch, setComponentSearch] = useState("");
  const [notice, setNotice] = useState<string | undefined>();

  const validation = useMemo(() => validateAppDocument(document), [document]);
  const selectedElement = document.spec.elements[selectedId];
  const selectedMeta = selectedElement ? registry.getComponent(selectedElement.type) : undefined;
  const components = registry.getAllComponents();
  const locales = useMemo(() => {
    const dictionaries = document.spec.state?.i18n;
    return isRecord(dictionaries) && Object.keys(dictionaries).length > 0
      ? Object.keys(dictionaries)
      : ["en-US"];
  }, [document.spec.state]);
  const diagnostics = registry.diagnostics();
  const viewportWidth = viewport === "desktop" ? 1200 : 768;

  const commit = (updater: (current: AppDocument) => AppDocument) => {
    setDocument((current) => {
      const next = updater(current);
      setPast((items) => [...items.slice(-29), current]);
      setFuture([]);
      setRevision((value) => value + 1);
      return next;
    });
  };

  const updateElement = (id: string, updater: (element: AppElement) => AppElement) => {
    commit((current) => {
      const element = current.spec.elements[id];
      if (!element) return current;
      return {
        ...current,
        spec: {
          ...current.spec,
          elements: { ...current.spec.elements, [id]: updater(element) },
        },
      };
    });
  };

  const addComponent = (type: string) => {
    const meta = registry.getComponent(type);
    if (!meta) return;
    const id = nextElementId(document, type);
    const parentId =
      selectedElement && selectedMeta?.slots?.default ? selectedId : document.spec.root;
    commit((current) => {
      const parent = current.spec.elements[parentId];
      if (!parent) return current;
      const newElement: AppElement = {
        type,
        name: `${meta.title} ${Object.keys(current.spec.elements).length + 1}`,
        props: defaultProps(meta),
      };
      return {
        ...current,
        spec: {
          ...current.spec,
          elements: {
            ...current.spec.elements,
            [id]: newElement,
            [parentId]: { ...parent, children: [...(parent.children ?? []), id] },
          },
        },
      };
    });
    setSelectedId(id);
  };

  const removeSelected = () => {
    if (selectedId === document.spec.root) return;
    const removed = collectDescendants(document, selectedId);
    const nextSelected = findParent(document, selectedId);
    commit((current) => {
      const elements = Object.fromEntries(
        Object.entries(current.spec.elements)
          .filter(([id]) => !removed.has(id))
          .map(([id, element]) => [
            id,
            {
              ...element,
              children: element.children?.filter((child) => !removed.has(child)),
              slots: Object.fromEntries(
                Object.entries(element.slots ?? {}).map(([slot, children]) => [
                  slot,
                  children.filter((child) => !removed.has(child)),
                ]),
              ),
            },
          ]),
      );
      return { ...current, spec: { ...current.spec, elements } };
    });
    setSelectedId(nextSelected);
  };

  const undo = () => {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [document, ...items]);
    setDocument(previous);
    setRevision((value) => value + 1);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, document]);
    setDocument(next);
    setRevision((value) => value + 1);
  };

  const copyJson = async () => {
    await navigator.clipboard?.writeText(JSON.stringify(document, null, 2));
    setNotice("JSON snapshot copied");
    window.setTimeout(() => setNotice(undefined), 1800);
  };

  const filteredComponents = components.filter((component) => {
    const query = componentSearch.trim().toLowerCase();
    return (
      !query ||
      [component.title, component.type, ...(component.tags ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  });

  return (
    <div className="flex h-svh min-h-[680px] flex-col overflow-hidden bg-[#f7f8fa] text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-3.5" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Studio</span>
          </div>
          <div className="hidden h-5 w-px bg-border sm:block" />
          <div className="hidden min-w-0 items-center gap-2 sm:flex">
            <span className="truncate text-xs font-medium">{document.pageInfo.title}</span>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
              Draft
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-2 hidden items-center gap-1.5 text-[10px] text-muted-foreground md:flex">
            {validation.valid ? (
              <Check className="size-3.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="size-3.5 text-destructive" />
            )}
            {validation.valid
              ? `Valid · rev ${revision}`
              : `${validation.issues.length} schema issues`}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Undo"
            onClick={undo}
            disabled={past.length === 0}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Redo"
            onClick={redo}
            disabled={future.length === 0}
          >
            <Redo2 />
          </Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button variant="outline" size="sm" onClick={() => void copyJson()}>
            <Copy /> <span className="hidden sm:inline">Copy JSON</span>
          </Button>
          <Button size="sm" onClick={() => setSurface("canvas")}>
            <Eye /> <span className="hidden sm:inline">Preview</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-background lg:flex">
          <div className="flex h-12 items-center gap-2 border-b border-border px-4 text-xs font-semibold">
            <PanelLeft className="size-3.5 text-muted-foreground" /> Components
          </div>
          <div className="border-b border-border p-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <input
                className="h-7 w-full rounded-lg border border-input bg-muted/40 pl-8 pr-2 text-xs outline-none focus-visible:border-ring"
                placeholder="Search components"
                value={componentSearch}
                onChange={(event) => setComponentSearch(event.target.value)}
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Registered Adapter
            </div>
            <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <span className="size-1.5 rounded-full bg-emerald-500" /> shadcn/ui
              </div>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                {components.length} stable JSON types available
              </p>
            </div>
            <div className="grid gap-1.5">
              {filteredComponents.map((component) => {
                const Icon =
                  componentIcons[component.type as keyof typeof componentIcons] ?? Settings2;
                return (
                  <button
                    key={component.type}
                    className="group flex items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-left hover:border-border hover:bg-muted"
                    onClick={() => addComponent(component.type)}
                  >
                    <span className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground group-hover:bg-background group-hover:text-primary">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">
                        {componentLabel(component.type)}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {component.category}
                      </span>
                    </span>
                    <Plus className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Document outline
              </div>
              <OutlineTree
                document={document}
                registry={registry}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </div>
          <div className="border-t border-border p-3 text-[10px] leading-4 text-muted-foreground">
            <span className="font-medium text-foreground">Meta-driven</span>
            <br />
            The palette only exposes registered component contracts.
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background/80 px-3 backdrop-blur">
            <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
              <button
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium",
                  surface === "canvas" && "bg-background shadow-sm",
                )}
                onClick={() => setSurface("canvas")}
              >
                <Eye className="size-3.5" /> Canvas
              </button>
              <button
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium",
                  surface === "json" && "bg-background shadow-sm",
                )}
                onClick={() => setSurface("json")}
              >
                <Code2 className="size-3.5" /> JSON
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                className="h-7 rounded-lg border border-input bg-background px-2 text-[11px]"
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
                aria-label="Preview locale"
              >
                {locales.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <div className="hidden items-center gap-0.5 rounded-lg border border-input p-0.5 sm:flex">
                <button
                  className={cn(
                    "grid size-6 place-items-center rounded-md text-muted-foreground",
                    viewport === "desktop" && "bg-muted text-foreground",
                  )}
                  onClick={() => setViewport("desktop")}
                  aria-label="Desktop viewport"
                >
                  <Monitor className="size-3.5" />
                </button>
                <button
                  className={cn(
                    "grid size-6 place-items-center rounded-md text-muted-foreground",
                    viewport === "tablet" && "bg-muted text-foreground",
                  )}
                  onClick={() => setViewport("tablet")}
                  aria-label="Tablet viewport"
                >
                  <Tablet className="size-3.5" />
                </button>
              </div>
              <span className="ml-1 hidden text-[10px] text-muted-foreground xl:inline">
                {viewportWidth}px viewport
              </span>
            </div>
          </div>
          {surface === "canvas" ? (
            <PreviewCanvas
              document={document}
              runtimeAdapters={runtimeAdapters}
              selectedId={selectedId}
              locale={locale}
              onSelect={setSelectedId}
              viewportWidth={viewportWidth}
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-auto bg-[#111827] p-4 text-xs text-slate-200 sm:p-8">
              <div className="mx-auto max-w-4xl">
                <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-400">
                  <FileJson className="size-3.5" /> Complete structured-clone snapshot · revision{" "}
                  {revision}
                </div>
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5">
                  {JSON.stringify(document, null, 2)}
                </pre>
              </div>
            </div>
          )}
          {notice && (
            <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-foreground px-3 py-1.5 text-[11px] text-background shadow-lg">
              {notice}
            </div>
          )}
        </main>

        <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-background xl:flex">
          <div className="flex h-12 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <PanelRight className="size-3.5 text-muted-foreground" /> Inspector
            </div>
            <button
              className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              onClick={removeSelected}
              disabled={selectedId === document.spec.root}
              aria-label="Delete selected node"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {selectedElement && selectedMeta ? (
              <div className="p-4">
                <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {selectedElement.name || selectedMeta.title}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {selectedElement.type} · #{selectedId}
                      </p>
                    </div>
                    <span className="rounded-md bg-primary/10 px-1.5 py-1 text-[9px] font-medium text-primary">
                      {selectedMeta.category}
                    </span>
                  </div>
                  <label className="mt-3 grid gap-1 text-[10px] font-medium text-muted-foreground">
                    Layer name
                    <input
                      className="h-7 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:border-ring"
                      value={selectedElement.name ?? ""}
                      onChange={(event) =>
                        updateElement(selectedId, (element) => ({
                          ...element,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <PropertyEditor
                  meta={selectedMeta}
                  props={selectedElement.props ?? {}}
                  state={document.spec.state}
                  onChange={(name, value) =>
                    updateElement(selectedId, (element) => ({
                      ...element,
                      props: { ...element.props, [name]: value },
                    }))
                  }
                />
              </div>
            ) : (
              <div className="grid place-items-center p-8 text-center text-xs text-muted-foreground">
                <Settings2 className="mb-2 size-5" />
                <p>Select a registered node to edit its Meta-defined properties.</p>
              </div>
            )}
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <MousePointer2 className="size-3" /> Selection
            </div>
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
              Canvas selection updates the JSON element ID without coupling Studio to a concrete UI
              component.
            </p>
          </div>
        </aside>
      </div>

      {(diagnostics.length > 0 || !validation.valid) && (
        <div className="absolute bottom-3 left-3 z-40 max-w-sm rounded-xl border border-destructive/30 bg-background/95 p-3 text-[10px] shadow-lg">
          <div className="flex items-center gap-1.5 font-semibold text-destructive">
            <AlertTriangle className="size-3.5" /> Contract diagnostics
          </div>
          {[
            ...diagnostics.map((issue) => issue.message),
            ...validation.issues.slice(0, 2).map((issue) => `${issue.path}: ${issue.message}`),
          ].map((message) => (
            <p key={message} className="mt-1 text-muted-foreground">
              {message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
