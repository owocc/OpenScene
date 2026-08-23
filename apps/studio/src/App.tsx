import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { PanelRight, PanelRightClose } from "lucide-react";

import { StudioCanvas } from "@/components/studio/canvas";
import { StudioSidebar } from "@/components/studio/sidebar";
import { ShortcutsProvider } from "@/components/studio/shortcuts";
import { PropertyEditor } from "@/components/studio/property-editor";
import { IconTooltip } from "@/components/studio/icon-tooltip";
import { useQueryStore } from "@/stores";
import { useI18n } from "@/i18n";
import { createOpenSceneClient, isApiProblem } from "@openscene/api-client";
import { SceneDocumentSchema, type SceneDocument } from "@openscene/protocol";
import type { JsonValue } from "@/core/document";
import { createEditorState, editorReducer, type EditorElement } from "@/core/editor-state";
import { defaultProps } from "@/core/meta";
import { materialManifestToAdapterMeta } from "@/core/material-manifest";
import { AdapterRegistry } from "@/core/registry";
import { getElementLocation, isSlotNodeId, parseSlotNodeId } from "@/core/slot-tree";
import { clearLocalDraft, readLocalDraft, writeLocalDraft } from "@/core/draft-storage";
import {
  loadStudioBootstrap,
  type StudioBootstrap,
  type StudioBootstrapState,
} from "@/core/studio-bootstrap";
import { cn } from "@/lib/utils";

function nextElementId(document: SceneDocument, type: string) {
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
  const { LL } = useI18n();
  return <StatusScreen title={LL.status.loadingTitle()} description={LL.status.loadingDesc()} />;
}

function StandaloneScreen() {
  const { LL } = useI18n();
  return (
    <StatusScreen title={LL.status.standaloneTitle()} description={LL.status.standaloneDesc()} />
  );
}

function MissingServerUrlScreen() {
  const { LL } = useI18n();
  return (
    <StatusScreen
      title={LL.status.missingServerUrlTitle()}
      description={LL.status.missingServerUrlDesc()}
      tone="error"
    />
  );
}

function StudioEditor({ bootstrap }: { bootstrap: StudioBootstrap }) {
  // Per-app view settings are keyed by the app id, which is only known after
  // bootstrap; preferences are global. Applies them before the editor state
  // is initialized so the first render already sees persisted values.
  useQueryStore.getState().applyAppSettings(bootstrap.app.id);
  const adapterMeta = useMemo(
    () => materialManifestToAdapterMeta(bootstrap.manifest),
    [bootstrap.manifest],
  );
  const registry = useMemo(() => new AdapterRegistry().register(adapterMeta), [adapterMeta]);
  const [editor, dispatch] = useReducer(editorReducer, bootstrap.draft.document, (document) => {
    const initial = createEditorState(document, bootstrap.draft.revision);
    const query = useQueryStore.getState();
    const querySelection =
      query.nodeId && query.nodeId in document.spec.elements
        ? [query.nodeId]
        : initial.selectedNodeIds;
    return {
      ...initial,
      selectedNodeIds: querySelection,
      selectedNodeId: querySelection[0] ?? null,
      surface: query.surface ?? initial.surface,
      locale: query.locale ?? initial.locale,
      activeToolMode: query.tool ?? initial.activeToolMode,
      viewport: {
        ...initial.viewport,
        selectedDeviceId: query.selectedDeviceId ?? initial.viewport.selectedDeviceId,
        currentDeviceWidth: query.currentDeviceWidth ?? initial.viewport.currentDeviceWidth,
        currentDeviceHeight: query.currentDeviceHeight ?? initial.viewport.currentDeviceHeight,
        zoom: query.zoom ?? initial.viewport.zoom,
        panX: query.panX ?? initial.viewport.panX,
        panY: query.panY ?? initial.viewport.panY,
        isRotated: query.rotated ?? initial.viewport.isRotated,
      },
    };
  });
  const {
    document,
    selectedNodeIds,
    selectedNodeId,
    past,
    future,
    revision,
    locale,
    surface,
    activeToolMode,
    viewport,
  } = editor;
  const { LL } = useI18n();
  const selectedId = selectedNodeId ?? "";
  const sidebarCollapsed = useQueryStore((s) => s.sidebarCollapsed);
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  // Element hovered in the preview iframe (select tool): highlights the
  // matching tree row without changing the selection.
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const serverRevisionRef = useRef(bootstrap.draft.revision);
  const savingRef = useRef(false);
  const [, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const localRevisionRef = useRef(revision);
  localRevisionRef.current = revision;
  const sessionId = bootstrap.session.id;

  // Local-first draft restore: prefer the IndexedDB draft for this session
  // over the server snapshot, then enable write-through once resolved.
  const writeThroughRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void readLocalDraft(sessionId).then((local) => {
      if (cancelled) return;
      if (local) dispatch({ type: "document.replace", document: local.document });
      writeThroughRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Persist every edit locally (debounced) so reloads restore the latest
  // state; the iframe is already kept in sync via DOCUMENT_SET on change.
  useEffect(() => {
    if (!writeThroughRef.current) return;
    const timer = window.setTimeout(() => {
      void writeLocalDraft(sessionId, revision, document);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [document, revision, sessionId]);

  const validationResult = useMemo(() => SceneDocumentSchema.safeParse(document), [document]);
  const validation = useMemo(
    () => ({
      valid: validationResult.success,
      issues: validationResult.success
        ? []
        : validationResult.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
    }),
    [validationResult],
  );
  const selectedElement = document.spec.elements[selectedId] as EditorElement | undefined;
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
    showNotice(LL.notices.jsonCopied());
  };

  const saveDocument = async () => {
    if (!bootstrap.capabilities.saveDraft) {
      showNotice(LL.notices.saveNotPersisted());
      return;
    }
    if (savingRef.current) return;
    const capturedDocument = document;
    const capturedRevision = revision;
    const baseRevision = serverRevisionRef.current;
    const query = useQueryStore.getState();
    if (!query.serverUrl || !query.sessionId || !query.token) {
      setSaveState("error");
      showNotice("Studio session expired; reopen Studio to save.");
      return;
    }
    savingRef.current = true;
    setSaveState("saving");
    try {
      const client = createOpenSceneClient({
        baseUrl: query.serverUrl.replace(/\/$/, ""),
        headers: { "x-openscene-session-token": query.token },
      }) as unknown as {
        PATCH: (
          path: string,
          options: unknown,
        ) => Promise<{
          data?: { revision: number; document: unknown };
          error?: unknown;
          response: Response;
        }>;
      };
      const result = await client.PATCH(`/api/v1/studio-sessions/${query.sessionId}/draft`, {
        body: { baseRevision, document: capturedDocument },
      });
      if (result.response.status === 409) {
        setSaveState("error");
        showNotice("Server draft changed; reopen Studio before saving again.");
        return;
      }
      if (result.error || !result.data) {
        const detail = isApiProblem(result.error)
          ? result.error.detail
          : `Save failed (${result.response.status})`;
        setSaveState("error");
        showNotice(detail);
        return;
      }
      const parsed = SceneDocumentSchema.safeParse(result.data.document);
      if (!parsed.success || typeof result.data.revision !== "number") {
        setSaveState("error");
        showNotice("Server returned an invalid canonical draft.");
        return;
      }
      serverRevisionRef.current = result.data.revision;
      setSaveState("saved");
      void clearLocalDraft(sessionId);
      showNotice(
        capturedRevision === localRevisionRef.current
          ? "Saved"
          : "Saved previous changes; newer edits remain unsaved.",
      );
    } catch (error) {
      setSaveState("error");
      showNotice(
        error instanceof Error ? `Save failed: ${error.message}` : "Save failed; try again.",
      );
    } finally {
      savingRef.current = false;
    }
  };

  // Synchronize editor state to URL query parameters
  useEffect(() => {
    useQueryStore.getState().setQuery(
      {
        surface,
        nodeId: selectedNodeId,
        locale,
        tool: activeToolMode,
        selectedDeviceId: viewport.selectedDeviceId,
        currentDeviceWidth: viewport.currentDeviceWidth,
        currentDeviceHeight: viewport.currentDeviceHeight,
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
      if (state.surface !== prevState.surface)
        dispatch({ type: "surface.set", surface: state.surface });
      if (state.nodeId !== prevState.nodeId) {
        dispatch({
          type: "nodes.select",
          nodeIds: state.nodeId ? [state.nodeId] : [],
          primaryNodeId: state.nodeId,
        });
      }
      if (state.locale && state.locale !== prevState.locale)
        dispatch({ type: "locale.switch", locale: state.locale });
      if (state.tool !== prevState.tool) dispatch({ type: "tool.set", mode: state.tool });
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
      if (state.propsCollapsed !== prevState.propsCollapsed)
        setPropertiesCollapsed(state.propsCollapsed);
    });
    return unsub;
  }, []);

  const updateElement = (id: string, updater: (element: EditorElement) => EditorElement) => {
    const element = document.spec.elements[id] as EditorElement | undefined;
    if (!element) return;
    dispatch({
      type: "element.update",
      elementId: id,
      element: updater(element),
    });
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

  const addComponent = (
    type: string,
    dropTarget?: { parentId: string; index?: number; slotName?: string },
  ) => {
    const meta = registry.getComponent(type);
    if (!meta) return;
    const id = nextElementId(document, type);
    const nextElement: EditorElement = {
      type,
      name: meta.title,
      props: defaultProps(meta),
      // json-render requires an explicit children array on every element;
      // the protocol schema tolerates its absence, but the runtime rejects it.
      children: [],
    };
    let target = dropTarget;
    if (!target && document.spec.root) {
      const slot = parseSlotNodeId(selectedId);
      if (slot) target = { parentId: slot.parentId, slotName: slot.slotName };
      else if (selectedElement && (!selectedMeta?.slots || selectedMeta.slots.default))
        target = { parentId: selectedId };
      else {
        const location = selectedId ? getElementLocation(document, selectedId) : undefined;
        target = location
          ? { ...location, index: (location.index ?? 0) + 1 }
          : { parentId: document.spec.root };
      }
    }
    dispatch({ type: "node.add", elementId: id, element: nextElement, target });
    dispatch({ type: "nodes.select", nodeIds: [id], primaryNodeId: id });
  };

  const removeSelected = () => {
    if (!selectedId || isSlotNodeId(selectedId)) return;
    dispatch({ type: "node.delete", elementId: selectedId });
  };

  const undo = () => dispatch({ type: "history.undo" });
  const redo = () => dispatch({ type: "history.redo" });

  return (
    <ShortcutsProvider
      onSave={saveDocument}
      onCopyJson={() => void copyJson()}
      onUndo={undo}
      onRedo={redo}
      onDeselect={() => dispatch({ type: "nodes.select", nodeIds: [], primaryNodeId: null })}
      onZoomIn={() =>
        dispatch({
          type: "viewport.patch",
          patch: { zoom: Math.min(viewport.zoom + 0.1, 5) },
        })
      }
      onZoomOut={() =>
        dispatch({
          type: "viewport.patch",
          patch: { zoom: Math.max(viewport.zoom - 0.1, 0.1) },
        })
      }
      onZoom100={() => dispatch({ type: "viewport.patch", patch: { zoom: 1 } })}
      onResetViewport={() =>
        dispatch({
          type: "viewport.patch",
          patch: { zoom: 1, panX: 0, panY: 0 },
        })
      }
    >
      <div className="relative h-svh w-screen overflow-hidden bg-background text-foreground select-none">
        {/* 1. Full-screen StudioCanvas Subsystem */}
        <StudioCanvas
          surface={surface}
          bootstrap={bootstrap}
          document={document}
          revision={revision}
          selectedNodeIds={selectedNodeIds}
          primaryNodeId={selectedNodeId}
          viewport={viewport}
          activeToolMode={activeToolMode}
          pastLength={past.length}
          futureLength={future.length}
          onPatchViewport={(patch) => dispatch({ type: "viewport.patch", patch })}
          onSurfaceChange={(nextSurface) => dispatch({ type: "surface.set", surface: nextSurface })}
          onToolChange={(mode) => dispatch({ type: "tool.set", mode })}
          onSelectionChange={(nodeIds, primaryNodeId) =>
            dispatch({ type: "nodes.select", nodeIds, primaryNodeId })
          }
          onHoverElement={setHoverNodeId}
          onFrameDrop={() => {
            const pending = (window as unknown as Record<string, string | null>)
              .__opensceneDraggingComponent;
            if (!pending) return;
            // Drop over the canvas lands on the currently selected element
            // (single selection is enforced), falling back to the default
            // target (root) when nothing is selected.
            addComponent(pending, selectedId ? { parentId: selectedId } : undefined);
          }}
          onUndo={undo}
          onRedo={redo}
          onCopyJson={() => void copyJson()}
          components={components}
          onAddComponent={addComponent}
          onSave={() => void saveDocument()}
        />

        {/* 2. Floating UI Layer: StudioSidebar (Hidden in text/document mode) */}
        {surface !== "text" && (
          <StudioSidebar
            bootstrap={bootstrap}
            document={document}
            registry={registry}
            selectedId={selectedId}
            hoverNodeId={hoverNodeId}
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
            viewport={viewport}
            onPatchViewport={(patch) => dispatch({ type: "viewport.patch", patch })}
            onAddComponent={addComponent}
            onSelectNode={(nodeId) =>
              dispatch({
                type: "nodes.select",
                nodeIds: nodeId ? [nodeId] : [],
                primaryNodeId: nodeId,
              })
            }
            onReorder={(elementId, parentId, index) =>
              dispatch({ type: "node.reorder", elementId, parentId, index })
            }
            onSurfaceChange={(nextSurface) =>
              dispatch({ type: "surface.set", surface: nextSurface })
            }
            onLocaleChange={(nextLocale) => dispatch({ type: "locale.switch", locale: nextLocale })}
            onUndo={undo}
            onRedo={redo}
            onCopyJson={() => void copyJson()}
            onSave={saveDocument}
          />
        )}
        {/* 3. Floating Collapsed Properties Pill (Minimal Figma style) */}
        {(surface === "visual" || surface === "developer") && propertiesCollapsed && (
          <div
            className={cn(
              "fixed z-30 hidden transition-all xl:block",
              sidebarCollapsed ? "top-4 right-4" : "top-3 right-3",
            )}
          >
            <IconTooltip label={LL.sidebar.expandProperties()} side="bottom">
              <button
                className="flex h-8 items-center gap-1.5 rounded-full border border-border/80 bg-background/95 px-3 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
                onClick={() => setPropertiesCollapsed(false)}
                aria-label={LL.sidebar.expandProperties()}
              >
                <span>{LL.properties.title()}</span>
                <PanelRight aria-hidden="true" className="size-4 text-foreground/80" />
              </button>
            </IconTooltip>
          </div>
        )}
        {/* 4. Right Properties Panel */}
        {(surface === "visual" || surface === "developer") && !propertiesCollapsed && (
          <div
            className={cn(
              "pointer-events-none fixed inset-y-0 right-0 z-30 hidden flex-col items-end transition-all xl:flex",
              sidebarCollapsed ? "p-4" : "p-0",
            )}
          >
            <aside
              className={cn(
                "pointer-events-auto flex w-80 flex-col overflow-hidden bg-background/95 backdrop-blur transition-all",
                sidebarCollapsed
                  ? "h-full rounded-2xl border border-border/80 shadow-lg"
                  : "h-full rounded-none border-l border-border/80",
              )}
            >
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/80 px-3">
                <span className="text-xs font-semibold">{LL.properties.title()}</span>
                <div className="flex items-center gap-1">
                  <button
                    className="rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                    onClick={removeSelected}
                    disabled={!selectedId || isSlotNodeId(selectedId)}
                    aria-label="Delete selected node"
                  >
                    {LL.common.delete()}
                  </button>
                  <IconTooltip label={LL.sidebar.collapse()} side="left">
                    <button
                      className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={() => setPropertiesCollapsed(true)}
                      aria-label={LL.sidebar.collapse()}
                    >
                      <PanelRightClose aria-hidden="true" className="size-4" />
                    </button>
                  </IconTooltip>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
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
                        {LL.properties.layerName()}
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
                      props={(selectedElement.props ?? {}) as Record<string, JsonValue>}
                      state={document.spec.state as Record<string, JsonValue> | undefined}
                      onChange={updateProp}
                    />
                  </div>
                ) : selectedElement ? (
                  <div className="p-3">
                    <div className="mb-3 rounded-xl border border-border bg-muted/30 p-3">
                      <p className="text-sm font-semibold">{selectedElement.type}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        #{selectedId}
                      </p>
                    </div>
                    <pre className="overflow-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-[10px] leading-4 text-foreground">
                      {JSON.stringify(selectedElement, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="grid place-items-center p-8 text-center text-xs text-muted-foreground">
                    <p>{LL.properties.empty()}</p>
                  </div>
                )}
              </div>
              <div className="border-t border-border/80 p-3">
                <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  {LL.properties.runtimeTitle()}
                </div>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                  {LL.properties.runtimeDesc()}
                </p>
              </div>
            </aside>
          </div>
        )}
        {notice && (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-foreground px-3 py-1.5 text-[11px] text-background shadow-lg">
            {notice}
          </div>
        )}

        {(diagnostics.length > 0 || !validation.valid) && (
          <div className="absolute bottom-3 left-3 z-40 max-w-sm rounded-xl border border-destructive/30 bg-background/95 p-3 text-[10px] shadow-lg">
            <div className="font-semibold text-destructive">{LL.panels.agents.diagnostics()}</div>
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
    </ShortcutsProvider>
  );
}

export function App() {
  const [state, setState] = useState<StudioBootstrapState>({
    status: "loading",
  });

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
