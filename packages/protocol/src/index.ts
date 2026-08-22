/**
 * Stable browser protocol identifier shared by Studio and renderer SDKs.
 * @zh Studio 与渲染器 SDK 共用的稳定浏览器协议标识符。
 */
export const STUDIO_BRIDGE_PROTOCOL = "openscene-studio";
/**
 * Increment when either side introduces a breaking message change.
 * @zh 任一端引入破坏性消息变更时递增。
 */
export const STUDIO_BRIDGE_VERSION = 1;

/**
 * Query parameters that opt an iframe into Studio inspection mode.
 * @zh 使 iframe 进入 Studio 检查模式的 query 参数。
 */
export const editorQueryKeys = {
  enabled: "openscene-editor",
  studioOrigin: "openscene-studio-origin",
  sessionId: "openscene-editor-session",
} as const;

/**
 * Origin and opaque session token negotiated through the iframe URL.
 * @zh 通过 iframe URL 协商的 origin 与不透明 session token。
 */
export interface EditorConnection {
  studioOrigin: string;
  sessionId: string;
}

/**
 * Versioned envelope transported through window.postMessage and MessagePort.
 * @zh 通过 window.postMessage 与 MessagePort 传输的版本化信封。
 */
export interface StudioBridgeEnvelope<TType extends string = string, TPayload = unknown> {
  protocol: typeof STUDIO_BRIDGE_PROTOCOL;
  version: typeof STUDIO_BRIDGE_VERSION;
  sessionId: string;
  type: TType;
  payload: TPayload;
}

/**
 * Serializable runtime node detail shown by Studio's tree and property panel.
 * @zh Studio 节点树与属性面板展示的可序列化运行时节点详情。
 */
export interface SceneNodeSnapshot {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children: string[];
  slots: Record<string, string[]>;
}

/**
 * Serializable JSON-render tree snapshot sent when a renderer connects.
 * @zh 渲染器建立连接时发送的可序列化 JSON-render 树快照。
 */
export interface SceneDocumentSnapshot {
  root: string;
  elements: Record<string, SceneNodeSnapshot>;
  state: Record<string, unknown>;
}

/**
 * Messages emitted by the renderer to Studio after the port is connected.
 * @zh 端口连接后由渲染器发送给 Studio 的消息。
 */
export type StudioPortMessage =
  | StudioBridgeEnvelope<"SCENE_DOCUMENT", SceneDocumentSnapshot>
  | StudioBridgeEnvelope<"SCENE_NODE_SELECTED", SceneNodeSnapshot>
  | StudioBridgeEnvelope<"SCENE_ERROR", { message: string }>;

/**
 * Messages emitted by Studio to a connected renderer.
 * @zh Studio 发送给已连接渲染器的消息。
 */
export type RendererPortMessage =
  | StudioBridgeEnvelope<"SCENE_CONNECT", undefined>
  | StudioBridgeEnvelope<"SCENE_SELECT", { elementId: string | null }>;

/**
 * Creates a protocol envelope without exposing mutable shared state.
 * @zh 创建协议信封，不暴露可变共享状态。
 */
export function createBridgeEnvelope<TType extends string, TPayload>(
  sessionId: string,
  type: TType,
  payload: TPayload,
): StudioBridgeEnvelope<TType, TPayload> {
  return { protocol: STUDIO_BRIDGE_PROTOCOL, version: STUDIO_BRIDGE_VERSION, sessionId, type, payload };
}

/**
 * Validates the stable envelope fields before a message is processed.
 * @zh 在处理消息前校验稳定的信封字段。
 */
export function isBridgeEnvelope(value: unknown): value is StudioBridgeEnvelope {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.protocol === STUDIO_BRIDGE_PROTOCOL && candidate.version === STUDIO_BRIDGE_VERSION && typeof candidate.sessionId === "string" && typeof candidate.type === "string";
}

/**
 * Reads and validates editor-mode connection values from a URL query string.
 * @zh 从 URL query string 读取并校验编辑模式连接参数。
 */
export function getEditorConnection(search: string): EditorConnection | null {
  const params = new URLSearchParams(search);
  const enabled = params.get(editorQueryKeys.enabled) === "1";
  const studioOrigin = params.get(editorQueryKeys.studioOrigin);
  const sessionId = params.get(editorQueryKeys.sessionId);
  if (!enabled || !studioOrigin || !sessionId) return null;
  try {
    const origin = new URL(studioOrigin).origin;
    return origin === studioOrigin ? { studioOrigin: origin, sessionId } : null;
  } catch {
    return null;
  }
}

/**
 * Appends a validated Studio connection to a target iframe URL.
 * @zh 将已校验的 Studio 连接参数追加到目标 iframe URL。
 */
export function withEditorConnection(url: string, connection: EditorConnection): string {
  const target = new URL(url, window.location.href);
  target.searchParams.set(editorQueryKeys.enabled, "1");
  target.searchParams.set(editorQueryKeys.studioOrigin, connection.studioOrigin);
  target.searchParams.set(editorQueryKeys.sessionId, connection.sessionId);
  return target.toString();
}
