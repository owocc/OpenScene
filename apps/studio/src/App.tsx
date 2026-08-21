import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  Eye,
  FileJson,
  Hand,
  Layers3,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Plus,
  RotateCw,
  Redo2,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CanvasViewport } from "@/components/studio/canvas-viewport";
import { OutlineTree } from "@/components/studio/outline-tree";
import { PreviewFrame } from "@/components/studio/preview-frame";
import { PropertyEditor } from "@/components/studio/property-editor";
import {
  normalizeAppDocument,
  type AppDocument,
  type AppElement,
  type JsonValue,
  validateAppDocument,
} from "@/core/document";
import { createEditorState, editorReducer, type ActiveToolMode } from "@/core/editor-state";
import { defaultProps } from "@/core/meta";
import { materialManifestToAdapterMeta } from "@/core/material-manifest";
import { AdapterRegistry } from "@/core/registry";
import { getElementLocation, isSlotNodeId, parseSlotNodeId } from "@/core/slot-tree";
import {
  loadStudioBootstrap,
  type StudioBootstrap,
  type StudioBootstrapState,
} from "@/core/studio-bootstrap";
import { cn } from "@/lib/utils";

function nextElementId(document: AppDocument, type: string) {
  const base = type.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  let index = 1;
  while (`${base}-${index}` in document.spec.elements) index += 1;
  return `${base}-${index}`;
}

function StatusScreen({
  title,
  description,
  tone = "neutral",
}: {
  title: string;
  description: string;
  tone?: "neutral" | "error";
}) {
  return (
    <div className="grid min-h-svh place-items-center bg-[#f7f8fa] p-6 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl shadow-slate-900/5">
        <div
          className={cn(
            "mb-4 grid size-9 place-items-center rounded-xl",
            tone === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary text-primary-foreground",
          )}
        >
          {tone === "error" ? (
            <AlertTriangle className="size-4" />
          ) : (
            <Sparkles className="size-4" />
          )}
        </div>
        <h1 className="text-base font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <StatusScreen
      title="Loading App session"
      description="Studio is waiting for the target App bootstrap and its material contract."
    />
  );
}

function StandaloneScreen() {
  return (
    <StatusScreen
      title="Open Studio from an App"
      description="Studio is headless by design. Launch it from the target App through an OpenScene Studio Session so the App can provide its document, material manifest and iframe preview."
    />
  );
}

function StudioEditor({ bootstrap }: { bootstrap: StudioBootstrap }) {
  const adapterMeta = useMemo(
    () => materialManifestToAdapterMeta(bootstrap.manifest),
    [bootstrap.manifest],
  );
  const registry = useMemo(() => new AdapterRegistry().register(adapterMeta), [adapterMeta]);
  const [editor, dispatch] = useReducer(
    editorReducer,
    normalizeAppDocument(bootstrap.draft.document),
    (document) => createEditorState(document, bootstrap.draft.revision),
  );
  const {
    document,
    selectedNodeId,
    past,
    future,
    revision,
    locale,
    surface,
    activeToolMode,
    viewport,
  } = editor;
  const selectedId = selectedNodeId ?? "";
  const [addType, setAddType] = useState("");
  const [notice, setNotice] = useState<string | undefined>();
  const activeToolRef = useRef(activeToolMode);
  const temporaryToolRef = useRef<ActiveToolMode | null>(null);

  const validation = useMemo(() => validateAppDocument(document), [document]);
  const previewIdentity = useMemo(
    () => ({
      appKey: bootstrap.app.key,
      resourceId: bootstrap.resource.id,
      resourceKind: bootstrap.resource.kind,
    }),
    [bootstrap.app.key, bootstrap.resource.id, bootstrap.resource.kind],
  );
  const selectedElement = document.spec.elements[selectedId];
  const selectedMeta = selectedElement ? registry.getComponent(selectedElement.type) : undefined;
  const components = registry.getAllComponents();
  const diagnostics = registry.diagnostics();
  const locales = useMemo(() => {
    const dictionaries = document.spec.state?.i18n;
    return dictionaries &&
      typeof dictionaries === "object" &&
      !Array.isArray(dictionaries) &&
      Object.keys(dictionaries).length > 0
      ? Object.keys(dictionaries)
      : [document.pageInfo.locale || "en-US"];
  }, [document.pageInfo.locale, document.spec.state]);

  useEffect(() => {
    activeToolRef.current = activeToolMode;
  }, [activeToolMode]);

  useEffect(() => {
    const isEditorField = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return target.matches("input, textarea, select, [contenteditable='true']");
    };
    const resetViewport = () =>
      dispatch({
        type: "viewport.patch",
        patch: { zoom: 1, panX: 0, panY: 0 },
      });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditorField(event.target)) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "history.redo" : "history.undo" });
        return;
      }
      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "history.redo" });
        return;
      }
      if (modifier && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        dispatch({ type: "viewport.patch", patch: { zoom: viewport.zoom + 0.1 } });
        return;
      }
      if (modifier && event.key === "-") {
        event.preventDefault();
        dispatch({ type: "viewport.patch", patch: { zoom: viewport.zoom - 0.1 } });
        return;
      }
      if (modifier && event.key === "0") {
        event.preventDefault();
        resetViewport();
        return;
      }
      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        temporaryToolRef.current = activeToolRef.current;
        dispatch({ type: "tool.set", mode: "hand" });
        return;
      }
      if (event.key.toLowerCase() === "v") dispatch({ type: "tool.set", mode: "select" });
      if (event.key.toLowerCase() === "i") dispatch({ type: "tool.set", mode: "interact" });
      if (event.key.toLowerCase() === "h") dispatch({ type: "tool.set", mode: "hand" });
      if (event.key === "0") resetViewport();
      if (event.key === "Escape") dispatch({ type: "node.select", nodeId: null });
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space" || !temporaryToolRef.current) return;
      dispatch({ type: "tool.set", mode: temporaryToolRef.current });
      temporaryToolRef.current = null;
    };
    const handleBlur = () => {
      if (!temporaryToolRef.current) return;
      dispatch({ type: "tool.set", mode: temporaryToolRef.current });
      temporaryToolRef.current = null;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [viewport.zoom]);

  const updateElement = (id: string, updater: (element: AppElement) => AppElement) => {
    const element = document.spec.elements[id];
    if (!element) return;
    dispatch({ type: "element.update", elementId: id, element: updater(element) });
  };

  const updateProp = (name: string, value: JsonValue) => {
    if (!selectedId) return;
    updateElement(selectedId, (element) => {
      const props = { ...element.props };
      if (value === "") delete props[name];
      else props[name] = value;
      return { ...element, props };
    });
  };

  const addComponent = () => {
    const meta = registry.getComponent(addType);
    if (!meta) return;
    const id = nextElementId(document, addType);
    const nextElement: AppElement = {
      type: addType,
      name: meta.title,
      props: defaultProps(meta),
    };
    let target: { parentId: string; slotName?: string; index?: number } | undefined;
    if (document.spec.root) {
      const slot = parseSlotNodeId(selectedId);
      if (slot) {
        target = { parentId: slot.parentId, slotName: slot.slotName };
      } else if (selectedElement && (!selectedMeta?.slots || selectedMeta.slots.default)) {
        target = { parentId: selectedId };
      } else {
        const location = selectedId ? getElementLocation(document, selectedId) : undefined;
        target = location
          ? { ...location, index: (location.index ?? 0) + 1 }
          : { parentId: document.spec.root };
      }
    }
    dispatch({ type: "node.add", elementId: id, element: nextElement, target });
    dispatch({ type: "node.select", nodeId: id });
    setAddType("");
  };

  const removeSelected = () => {
    if (!selectedId || isSlotNodeId(selectedId)) return;
    dispatch({ type: "node.delete", elementId: selectedId });
  };

  const undo = () => {
    dispatch({ type: "history.undo" });
  };

  const redo = () => {
    dispatch({ type: "history.redo" });
  };

  const copyJson = async () => {
    await navigator.clipboard?.writeText(JSON.stringify(document, null, 2));
    setNotice("JSON snapshot copied");
    window.setTimeout(() => setNotice(undefined), 1800);
  };

  return (
    <div className="flex h-svh min-h-[680px] flex-col overflow-hidden bg-[#f7f8fa] text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{bootstrap.app.name}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                Headless Studio
              </span>
            </div>
            <p className="truncate text-[10px] text-muted-foreground">
              {bootstrap.resource.title} · {bootstrap.resource.kind} · App-owned materials
            </p>
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
          <Button variant="outline" size="sm" onClick={() => void copyJson()}>
            <Copy />
            <span className="hidden sm:inline">Copy JSON</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-background lg:flex">
          <div className="flex h-12 items-center gap-2 border-b border-border px-4 text-xs font-semibold">
            <PanelLeft className="size-3.5 text-muted-foreground" /> Node tree
          </div>
          <div className="min-h-0 flex-1 overscroll-contain overflow-auto p-3">
            {document.spec.root ? (
              <OutlineTree
                document={document}
                registry={registry}
                selectedId={selectedId}
                onSelect={(nodeId) => dispatch({ type: "node.select", nodeId })}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border p-4 text-xs leading-5 text-muted-foreground">
                当前文档为空。可以从模板系统或 App material contract 添加第一个 root 节点。
              </div>
            )}
          </div>
          <div className="border-t border-border p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Layers3 className="size-3" /> App material contract
            </div>
            <p className="text-[10px] leading-4 text-muted-foreground">
              {components.length} types loaded from {bootstrap.app.key}. Studio keeps no local
              material catalog.
            </p>
            <div className="mt-3 flex gap-1.5">
              <select
                className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-[11px]"
                value={addType}
                onChange={(event) => setAddType(event.target.value)}
                aria-label="Add App node"
              >
                <option value="">Add node…</option>
                {components.map((component) => (
                  <option key={component.type} value={component.type}>
                    {component.title}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Add node"
                onClick={addComponent}
                disabled={!addType}
              >
                <Plus />
              </Button>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background/80 px-3 backdrop-blur">
            <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
              <button
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium",
                  surface === "preview" && "bg-background shadow-sm",
                )}
                onClick={() => dispatch({ type: "surface.set", surface: "preview" })}
              >
                <Eye className="size-3.5" /> Preview iframe
              </button>
              <button
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium",
                  surface === "json" && "bg-background shadow-sm",
                )}
                onClick={() => dispatch({ type: "surface.set", surface: "json" })}
              >
                <Code2 className="size-3.5" /> JSON
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                className="h-7 rounded-lg border border-input bg-background px-2 text-[11px]"
                value={locale}
                onChange={(event) =>
                  dispatch({ type: "locale.switch", locale: event.target.value })
                }
                aria-label="Preview locale"
              >
                {locales.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <span className="hidden text-[10px] text-muted-foreground sm:inline">
                manifest {bootstrap.manifest?.protocolVersion ?? "none"}
              </span>
              <div className="hidden items-center gap-1 sm:flex">
                {(
                  [
                    ["select", "Select", MousePointer2],
                    ["interact", "Interact", Eye],
                    ["hand", "Hand", Hand],
                  ] as const
                ).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    className={cn(
                      "grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted",
                      activeToolMode === mode && "bg-muted text-foreground",
                    )}
                    title={label}
                    aria-label={label}
                    onClick={() => dispatch({ type: "tool.set", mode: mode as ActiveToolMode })}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-border" />
                <button
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                  title="Zoom out"
                  aria-label="Zoom out"
                  onClick={() =>
                    dispatch({ type: "viewport.patch", patch: { zoom: viewport.zoom - 0.1 } })
                  }
                >
                  <ZoomOut className="size-3.5" />
                </button>
                <span className="w-9 text-center text-[10px] text-muted-foreground">
                  {Math.round(viewport.zoom * 100)}%
                </span>
                <button
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                  title="Zoom in"
                  aria-label="Zoom in"
                  onClick={() =>
                    dispatch({ type: "viewport.patch", patch: { zoom: viewport.zoom + 0.1 } })
                  }
                >
                  <ZoomIn className="size-3.5" />
                </button>
                <button
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                  title="Rotate device"
                  aria-label="Rotate device"
                  onClick={() =>
                    dispatch({
                      type: "viewport.patch",
                      patch: { isRotated: !viewport.isRotated },
                    })
                  }
                >
                  <RotateCw className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
          {surface === "preview" ? (
            <CanvasViewport
              viewport={viewport}
              activeToolMode={activeToolMode}
              onPatch={(patch) => dispatch({ type: "viewport.patch", patch })}
            >
              <PreviewFrame
                url={bootstrap.preview.url}
                allowedOrigin={bootstrap.preview.allowedOrigin}
                identity={previewIdentity}
                document={document}
                locale={locale}
                revision={revision}
                selectedId={selectedId}
                interactionMode={activeToolMode === "select" ? "select" : "preview"}
                onSelect={(nodeId) => dispatch({ type: "node.select", nodeId })}
              />
            </CanvasViewport>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto bg-[#111827] p-4 text-xs text-slate-200 sm:p-8">
              <div className="mx-auto max-w-4xl">
                <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-400">
                  <FileJson className="size-3.5" /> Draft snapshot · revision {revision}
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
              <PanelRight className="size-3.5 text-muted-foreground" /> Properties
            </div>
            <button
              className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              onClick={removeSelected}
              disabled={!selectedId || isSlotNodeId(selectedId)}
              aria-label="Delete selected node"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overscroll-contain overflow-auto">
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
                  componentType={selectedElement.type}
                  elementId={selectedId}
                  props={selectedElement.props ?? {}}
                  state={document.spec.state}
                  onChange={updateProp}
                />
              </div>
            ) : (
              <div className="grid place-items-center p-8 text-center text-xs text-muted-foreground">
                <Settings2 className="mb-2 size-5" />
                <p>选择节点后编辑目标 App 提供的属性 Meta。</p>
              </div>
            )}
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <PanelRight className="size-3" /> App-owned runtime
            </div>
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
              Preview is rendered by the target App iframe. Studio only sends document snapshots
              through Preview Bridge.
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

export function App() {
  const [state, setState] = useState<StudioBootstrapState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void loadStudioBootstrap(controller.signal)
      .then(setState)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Unable to load Studio session",
        });
      });
    return () => controller.abort();
  }, []);

  if (state.status === "loading") return <LoadingScreen />;
  if (state.status === "standalone") return <StandaloneScreen />;
  if (state.status === "error")
    return (
      <StatusScreen title="Studio session unavailable" description={state.message} tone="error" />
    );
  return <StudioEditor bootstrap={state.value} />;
}

export default App;
