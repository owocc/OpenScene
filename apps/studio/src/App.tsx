import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { PanelRight, PanelRightClose } from "lucide-react";
import { StudioCanvas } from "@/components/studio/canvas";
import { StudioSidebar } from "@/components/studio/sidebar";
import { PropertyEditor } from "@/components/studio/property-editor";
import { IconTooltip } from "@/components/studio/icon-tooltip";
import { useQueryStore } from "@/stores";
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
    <div className="grid min-h-svh place-items-center bg-muted/40 p-6 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl shadow-slate-900/5">
        <div
          className={cn(
            "mb-4 h-1.5 w-12 rounded-full",
            tone === "error" ? "bg-destructive" : "bg-primary",
          )}
        />
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

function MissingServerUrlScreen() {
  return (
    <StatusScreen
      title="缺少必要参数 server-url"
      description="Studio 遵循无本地存储架构，不内置任何默认后端地址。必须通过 URL query 参数显式提供目标后端服务地址，例如：?server-url=http://localhost:3000&sessionId=...#token=..."
      tone="error"
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
    (document) => {
      const initial = createEditorState(document, bootstrap.draft.revision);
      const query = useQueryStore.getState();
      return {
        ...initial,
        surface: query.surface ?? initial.surface,
        selectedNodeId: query.nodeId ?? initial.selectedNodeId,
        locale: query.locale ?? initial.locale,
        activeToolMode: query.tool ?? initial.activeToolMode,
        viewport: {
          ...initial.viewport,
          zoom: query.zoom ?? initial.viewport.zoom,
          panX: query.panX ?? initial.viewport.panX,
          panY: query.panY ?? initial.viewport.panY,
          isRotated: query.rotated ?? initial.viewport.isRotated,
        },
      };
    },
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
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const activeToolRef = useRef(activeToolMode);
  const temporaryToolRef = useRef<ActiveToolMode | null>(null);

  const validation = useMemo(() => validateAppDocument(document), [document]);
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

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(undefined), 1800);
  };

  const copyJson = async () => {
    await navigator.clipboard?.writeText(JSON.stringify(document, null, 2));
    showNotice("JSON snapshot copied");
  };

  const saveDocument = () => {
    showNotice(
      bootstrap.capabilities.saveDraft
        ? "Save command sent to the target App"
        : "Local session changes are not persisted",
    );
  };

  useEffect(() => {
    activeToolRef.current = activeToolMode;
  }, [activeToolMode]);

  // Synchronize editor state to URL query parameters
  useEffect(() => {
    useQueryStore.getState().setQuery(
      {
        surface,
        nodeId: selectedNodeId,
        locale,
        tool: activeToolMode,
        zoom: viewport.zoom,
        panX: viewport.panX,
        panY: viewport.panY,
        rotated: viewport.isRotated,
        propsCollapsed: propertiesCollapsed,
      },
      { push: false },
    );
  }, [surface, selectedNodeId, locale, activeToolMode, viewport, propertiesCollapsed]);

  // Subscribe to external/browser popstate URL query changes
  useEffect(() => {
    const unsub = useQueryStore.subscribe((state, prevState) => {
      if (state.surface !== prevState.surface) {
        dispatch({ type: "surface.set", surface: state.surface });
      }
      if (state.nodeId !== prevState.nodeId) {
        dispatch({ type: "node.select", nodeId: state.nodeId });
      }
      if (state.locale && state.locale !== prevState.locale) {
        dispatch({ type: "locale.switch", locale: state.locale });
      }
      if (state.tool !== prevState.tool) {
        dispatch({ type: "tool.set", mode: state.tool });
      }
      if (
        state.zoom !== prevState.zoom ||
        state.panX !== prevState.panX ||
        state.panY !== prevState.panY ||
        state.rotated !== prevState.rotated
      ) {
        dispatch({
          type: "viewport.patch",
          patch: {
            ...(state.zoom !== null ? { zoom: state.zoom } : {}),
            ...(state.panX !== null ? { panX: state.panX } : {}),
            ...(state.panY !== null ? { panY: state.panY } : {}),
            isRotated: state.rotated,
          },
        });
      }
      if (state.propsCollapsed !== prevState.propsCollapsed) {
        setPropertiesCollapsed(state.propsCollapsed);
      }
    });
    return unsub;
  }, []);
  useEffect(() => {
    const isEditorField = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return target.matches("input, textarea, select, [contenteditable='true']");
    };
    const resetViewport = () =>
      dispatch({ type: "viewport.patch", patch: { zoom: 1, panX: 0, panY: 0 } });
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
      if (modifier && event.key === "1") {
        event.preventDefault();
        dispatch({ type: "surface.set", surface: "developer" });
        return;
      }
      if (modifier && event.key === "2") {
        event.preventDefault();
        dispatch({ type: "surface.set", surface: "preview" });
        return;
      }
      if (modifier && event.key === "3") {
        event.preventDefault();
        dispatch({ type: "surface.set", surface: "text" });
        return;
      }
      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveDocument();
        return;
      }
      if (modifier && event.key.toLowerCase() === "c") {
        event.preventDefault();
        void copyJson();
        return;
      }
      if (modifier && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        const nextZoom = Math.min(Number((viewport.zoom + 0.1).toFixed(2)), 5);
        dispatch({ type: "viewport.patch", patch: { zoom: nextZoom } });
        return;
      }
      if (modifier && (event.key === "-" || event.key === "_")) {
        event.preventDefault();
        const nextZoom = Math.max(Number((viewport.zoom - 0.1).toFixed(2)), 0.1);
        dispatch({ type: "viewport.patch", patch: { zoom: nextZoom } });
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

  const undo = () => dispatch({ type: "history.undo" });
  const redo = () => dispatch({ type: "history.redo" });

  return (
    <div className="relative h-svh w-screen overflow-hidden bg-background text-foreground select-none">
      {/* 1. Full-screen StudioCanvas Subsystem */}
      <StudioCanvas
        kind="web-iframe"
        surface={surface}
        bootstrap={bootstrap}
        document={document}
        locale={locale}
        revision={revision}
        selectedId={selectedId}
        viewport={viewport}
        activeToolMode={activeToolMode}
        onPatchViewport={(patch) => dispatch({ type: "viewport.patch", patch })}
        onSurfaceChange={(nextSurface) => dispatch({ type: "surface.set", surface: nextSurface })}
        onToolChange={(mode) => dispatch({ type: "tool.set", mode })}
        onRotate={() =>
          dispatch({
            type: "viewport.patch",
            patch: { isRotated: !viewport.isRotated },
          })
        }
        onSelectNode={(nodeId) => dispatch({ type: "node.select", nodeId })}
      />

      {/* 2. Floating UI Layer: StudioSidebar (Docked on the left above canvas) */}
      <StudioSidebar
        bootstrap={bootstrap}
        document={document}
        registry={registry}
        selectedId={selectedId}
        surface={surface}
        revision={revision}
        valid={validation.valid}
        locale={locale}
        locales={locales}
        manifestVersion={bootstrap.manifest?.protocolVersion ?? "none"}
        components={components}
        diagnostics={diagnostics}
        pastLength={past.length}
        futureLength={future.length}
        addType={addType}
        onSetAddType={setAddType}
        onAddComponent={addComponent}
        onSelectNode={(nodeId) => dispatch({ type: "node.select", nodeId })}
        onSurfaceChange={(nextSurface) => dispatch({ type: "surface.set", surface: nextSurface })}
        onLocaleChange={(nextLocale) => dispatch({ type: "locale.switch", locale: nextLocale })}
        onUndo={undo}
        onRedo={redo}
        onCopyJson={() => void copyJson()}
        onSave={saveDocument}
      />

      {/* Floating Collapsed Properties Pill (Minimal Figma style) */}
      {surface === "developer" && propertiesCollapsed && (
        <div className="fixed top-3 right-3 z-30 hidden xl:block">
          <IconTooltip label="展开属性面板" side="bottom">
            <button
              className="flex h-8 items-center gap-1.5 rounded-full border border-border/80 bg-background/95 px-3 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
              onClick={() => setPropertiesCollapsed(false)}
              aria-label="展开属性面板"
            >
              <span>属性</span>
              <PanelRight aria-hidden="true" className="size-4 text-foreground/80" />
            </button>
          </IconTooltip>
        </div>
      )}

      {surface === "developer" && !propertiesCollapsed && (
        <aside className="fixed inset-y-0 right-0 z-30 hidden w-80 flex-col overflow-hidden border-l border-border/80 bg-background/95 backdrop-blur xl:flex">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/80 px-3">
            <span className="text-xs font-semibold">属性</span>
            <div className="flex items-center gap-1">
              <button
                className="rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                onClick={removeSelected}
                disabled={!selectedId || isSlotNodeId(selectedId)}
                aria-label="Delete selected node"
              >
                删除
              </button>
              <IconTooltip label="折叠属性面板" side="left">
                <button
                  className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => setPropertiesCollapsed(true)}
                  aria-label="折叠属性面板"
                >
                  <PanelRightClose aria-hidden="true" className="size-4" />
                </button>
              </IconTooltip>
            </div>
          </div>
          <div className="min-h-0 flex-1 overscroll-contain overflow-auto">
            {selectedElement && selectedMeta ? (
              <div className="p-3">
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
                <p>选择节点后编辑目标 App 提供的属性 Meta。</p>
              </div>
            )}
          </div>
          <div className="border-t border-border/80 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              App-owned runtime
            </div>
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
              Preview is rendered by the target App iframe. Studio only sends document snapshots
              through Preview Bridge.
            </p>
          </div>
        </aside>
      )}
      {notice && (
        <div className="absolute bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-foreground px-3 py-1.5 text-[11px] text-background shadow-lg">
          {notice}
        </div>
      )}
      {(diagnostics.length > 0 || !validation.valid) && (
        <div className="absolute bottom-3 left-3 z-40 max-w-sm rounded-xl border border-destructive/30 bg-background/95 p-3 text-[10px] shadow-lg">
          <div className="font-semibold text-destructive">Contract diagnostics</div>
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
  if (state.status === "missing-server-url") return <MissingServerUrlScreen />;
  if (state.status === "error") {
    return (
      <StatusScreen title="Studio session unavailable" description={state.message} tone="error" />
    );
  }
  return <StudioEditor bootstrap={state.value} />;
}

export default App;
