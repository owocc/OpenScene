import {
  BridgeEnvelopeSchema,
  RendererPortMessageSchema,
  RendererWindowMessageSchema,
  RuntimePageDeliverySchema,
  StudioPortMessageSchema,
  StudioWindowMessageSchema,
  createBridgeEnvelope,
  getEditorConnection,
  type AppManifest,
  type EditorConnection,
  type ElementRect,
  type RendererPortMessage,
  type SceneDocument,
  type StudioPortMessage,
} from "@openscene/protocol";
import { createStateStore, type StateStore } from "@json-render/core";

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type OpenSceneStatus = "loading" | "ready" | "error";
export type OpenSceneInteractionMode = "select" | "preview";

export interface OpenSceneClientOptions {
  apiBaseUrl: string;
  pageKey: string;
  manifest: AppManifest;
}

export interface OpenSceneClientState {
  status: OpenSceneStatus;
  document: DeepReadonly<SceneDocument> | null;
  runtimeStore: StateStore | null;
  interactionMode: OpenSceneInteractionMode;
  selectedElementIds: readonly string[];
  primaryElementId: string | null;
  revision: number | null;
  error: Error | null;
}

export interface SelectionReport {
  elementIds: string[];
  primaryElementId: string | null;
  source: "click" | "marquee";
  /** Bounding boxes relative to the iframe viewport, keyed by element id. */
  rects?: Record<string, ElementRect>;
}

export interface OpenSceneClient {
  readonly manifest: AppManifest;
  readonly appType: AppManifest["app"]["type"];
  getSnapshot(): OpenSceneClientState;
  subscribe(listener: () => void): () => void;
  loadPage(pageKey?: string): Promise<void>;
  reportRendered(): void;
  reportSelection(payload: SelectionReport): void;
  reportHover(elementId: string | null, rect?: ElementRect | null): void;
  reportRendererError(error: unknown): void;
  destroy(): void;
  /**
   * Registered by the renderer layer: computes an element's bounding box
   * relative to the frame viewport. Studio requests it via
   * ELEMENT_GEOMETRY_REQUEST when it needs geometry for a tree selection.
   */
  onGeometryRequest?: ((elementId: string) => ElementRect | null) | null;
}

const emptyState = (): OpenSceneClientState => ({
  status: "loading",
  document: null,
  // Always provide a store so json-render's StateProvider stays controlled;
  // switching from null to a real store (uncontrolled → controlled) is unsupported.
  runtimeStore: createStateStore({}),
  interactionMode: "select",
  selectedElementIds: [],
  primaryElementId: null,
  revision: null,
  error: null,
});

function freezeDeep<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child, seen);
  return Object.freeze(value);
}

function asError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string" && error.length > 0) return new Error(error);
  return new Error("OpenScene client request failed");
}

function baseApiUrl(apiBaseUrl: string): string {
  return apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
}

function runtimeUrl(options: OpenSceneClientOptions, pageKey: string): string {
  return `${baseApiUrl(options.apiBaseUrl)}/api/v1/runtime/apps/${encodeURIComponent(options.manifest.app.key)}/pages/${encodeURIComponent(pageKey)}`;
}

function errorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Renderer error";
  return message.trim() || "Renderer error";
}

/**
 * Owns the transport and runtime document state. Framework adapters subscribe
 * to this controller; they never need to know whether a document came from
 * Admin or a Studio MessagePort.
 */
export class OpenSceneController implements OpenSceneClient {
  readonly manifest: AppManifest;
  readonly appType: AppManifest["app"]["type"];

  private readonly options: OpenSceneClientOptions;
  private readonly listeners = new Set<() => void>();
  private state: OpenSceneClientState = emptyState();
  private editorConnection: EditorConnection | null = null;
  private port: MessagePort | null = null;
  private abortController: AbortController | null = null;
  private destroyed = false;
  private pageKey: string;
  private readonly onWindowMessage = (event: MessageEvent<unknown>) =>
    this.handleWindowMessage(event);
  private readonly onPortMessage = (event: MessageEvent<unknown>) => this.handlePortMessage(event);
  onGeometryRequest?: ((elementId: string) => ElementRect | null) | null = null;

  constructor(
    options: OpenSceneClientOptions,
    private readonly targetWindow: Window | null = typeof window === "undefined" ? null : window,
  ) {
    this.pageKey = options.pageKey;
    this.manifest = freezeDeep(structuredClone(options.manifest));
    this.options = { ...options, manifest: this.manifest };
    this.appType = this.manifest.app.type;
    const connection = targetWindow ? getEditorConnection(targetWindow.location.search) : null;
    const editorRequested = targetWindow
      ? new URLSearchParams(targetWindow.location.search).has("openscene-editor")
      : false;
    if (connection) {
      this.editorConnection = connection;
      this.targetWindow?.addEventListener("message", this.onWindowMessage);
      this.announceRendererReady();
    } else if (editorRequested) {
      this.setState({ status: "error", error: new Error("Invalid OpenScene editor connection") });
    } else {
      void this.loadPage();
    }
  }
  getSnapshot(): OpenSceneClientState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async loadPage(pageKey = this.pageKey): Promise<void> {
    if (this.destroyed) return;
    this.pageKey = pageKey;
    if (this.editorConnection) return;
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;
    this.setState({ status: "loading", error: null });
    try {
      const response = await fetch(runtimeUrl(this.options, pageKey), {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Runtime page request failed (${response.status})`);
      const payload: unknown = await response.json();
      const parsed = RuntimePageDeliverySchema.safeParse(payload);
      if (!parsed.success) throw new Error("Runtime page response failed protocol validation");
      if (
        parsed.data.app.key !== this.manifest.app.key ||
        parsed.data.app.type !== this.manifest.app.type
      ) {
        throw new Error("Runtime page response app identity does not match the manifest");
      }
      if (parsed.data.page.key !== pageKey)
        throw new Error("Runtime page response key does not match the requested page");
      this.replaceDocument(parsed.data.document, null);
    } catch (error) {
      if (controller.signal.aborted || this.destroyed) return;
      this.setState({ status: "error", error: asError(error) });
    } finally {
      if (this.abortController === controller) this.abortController = null;
    }
  }

  reportRendered(): void {
    if (!this.editorConnection || !this.port || !this.state.document) return;
    const envelope = createBridgeEnvelope(this.editorConnection.sessionId, "DOCUMENT_RENDERED", {
      schemaVersion: this.state.document.schemaVersion,
      root: this.state.document.spec.root,
    });
    const parsed = RendererPortMessageSchema.safeParse(envelope);
    if (parsed.success) this.sendPortMessage(parsed.data);
  }

  reportSelection(payload: SelectionReport): void {
    if (!this.editorConnection || !this.port) return;
    const elementIds = [...new Set(payload.elementIds)];
    const primaryElementId =
      payload.primaryElementId && elementIds.includes(payload.primaryElementId)
        ? payload.primaryElementId
        : (elementIds[0] ?? null);
    const rects = Object.fromEntries(
      elementIds
        .map((id) => [id, payload.rects?.[id]])
        .filter((entry): entry is [string, ElementRect] => entry[1] != null),
    );
    const message = createBridgeEnvelope(this.editorConnection.sessionId, "SELECTION_CHANGED", {
      elementIds,
      primaryElementId,
      source: payload.source,
      rects,
    });
    const parsed = RendererPortMessageSchema.safeParse(message);
    if (!parsed.success) return;
    this.setState({ selectedElementIds: elementIds, primaryElementId });
    this.sendPortMessage(parsed.data);
  }

  reportHover(elementId: string | null, rect: ElementRect | null = null): void {
    if (!this.editorConnection || !this.port) return;
    const message = createBridgeEnvelope(this.editorConnection.sessionId, "ELEMENT_HOVER", {
      elementId,
      rect,
    });
    const parsed = RendererPortMessageSchema.safeParse(message);
    if (parsed.success) this.sendPortMessage(parsed.data);
  }

  reportRendererError(error: unknown): void {
    const message = errorMessage(error);
    if (this.editorConnection && this.port) {
      const envelope = createBridgeEnvelope(this.editorConnection.sessionId, "RENDERER_ERROR", {
        message,
      });
      const parsed = RendererPortMessageSchema.safeParse(envelope);
      if (parsed.success) this.sendPortMessage(parsed.data);
    }
    this.setState({ status: "error", error: new Error(message) });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abortController?.abort();
    this.abortController = null;
    this.targetWindow?.removeEventListener("message", this.onWindowMessage);
    this.port?.removeEventListener("message", this.onPortMessage);
    this.port?.close();
    this.port = null;
    this.listeners.clear();
  }

  private announceRendererReady(): void {
    if (!this.targetWindow || !this.editorConnection) return;
    const envelope = createBridgeEnvelope(this.editorConnection.sessionId, "RENDERER_READY", {
      appType: this.appType,
    });
    const parsed = RendererWindowMessageSchema.safeParse(envelope);
    if (!parsed.success) return;
    const parent = this.targetWindow.parent;
    if (parent && parent !== this.targetWindow)
      parent.postMessage(parsed.data, this.editorConnection.studioOrigin);
  }

  private handleWindowMessage(event: MessageEvent<unknown>): void {
    if (!this.editorConnection || this.destroyed || !this.targetWindow) return;
    if (
      event.source !== this.targetWindow.parent ||
      event.origin !== this.editorConnection.studioOrigin
    )
      return;
    const parsed = StudioWindowMessageSchema.safeParse(event.data);
    if (!parsed.success || parsed.data.sessionId !== this.editorConnection.sessionId) return;
    const port = event.ports[0];
    if (!port) {
      this.setState({
        status: "error",
        error: new Error("Studio connection did not transfer a MessagePort"),
      });
      return;
    }
    this.port?.close();
    this.port = port;
    this.port.addEventListener("message", this.onPortMessage);
    this.port.start();
  }

  private handlePortMessage(event: MessageEvent<unknown>): void {
    if (!this.editorConnection || !this.port || this.destroyed) return;
    const envelope = BridgeEnvelopeSchema.safeParse(event.data);
    if (!envelope.success || envelope.data.sessionId !== this.editorConnection.sessionId) return;
    const parsed = StudioPortMessageSchema.safeParse(event.data);
    if (!parsed.success) return;
    this.handleStudioMessage(parsed.data);
  }

  private handleStudioMessage(message: StudioPortMessage): void {
    if (message.type === "DOCUMENT_SET") {
      this.replaceDocument(message.payload.document, message.payload.revision);
    } else if (message.type === "ELEMENT_GEOMETRY_REQUEST") {
      const rect = this.onGeometryRequest?.(message.payload.elementId) ?? null;
      if (!rect || !this.editorConnection || !this.port) return;
      const reply = createBridgeEnvelope(this.editorConnection.sessionId, "ELEMENT_GEOMETRY", {
        elementId: message.payload.elementId,
        rect,
      });
      const parsed = RendererPortMessageSchema.safeParse(reply);
      if (parsed.success) this.sendPortMessage(parsed.data);
    } else {
      this.setState({
        interactionMode: message.payload.interactionMode,
        selectedElementIds: [...message.payload.selectedElementIds],
        primaryElementId: message.payload.selectedElementIds[0] ?? null,
      });
    }
  }

  private replaceDocument(document: SceneDocument, revision: number | null): void {
    const frozen = freezeDeep(document);
    const runtimeState = {
      ...document.spec.state,
      __scene: { pageInfo: document.pageInfo, globalConfig: document.globalConfig },
    };
    this.setState({
      status: "ready",
      document: frozen,
      runtimeStore: createStateStore(runtimeState),
      revision,
      error: null,
      selectedElementIds: [],
      primaryElementId: null,
    });
    this.reportRendered();
  }

  private sendPortMessage(message: RendererPortMessage): void {
    try {
      this.port?.postMessage(message);
    } catch (error) {
      this.setState({ status: "error", error: asError(error) });
    }
  }

  private setState(patch: Partial<OpenSceneClientState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}

export function installOpenScene(options: OpenSceneClientOptions): OpenSceneClient {
  const client = new OpenSceneController(options);
  if (typeof window !== "undefined") window.OpenScene = client;
  return client;
}

declare global {
  interface Window {
    OpenScene: OpenSceneClient;
  }
}
