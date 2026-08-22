export {
  SCENE_DOCUMENT_SCHEMA_VERSION,
  SceneDocumentSchema,
  createEmptySceneDocument,
} from "./document.js";
export type {
  SceneDocument,
  SceneGlobalConfig,
  ScenePageInfo,
  Spec,
  UIElement,
} from "./document.js";

export {
  AppManifestSchema,
  ComponentManifestSchema,
  RuntimePageDeliverySchema,
} from "./manifest.js";
export type { AppManifest, ComponentManifest, RuntimePageDelivery } from "./manifest.js";

export {
  BridgeEnvelopeSchema,
  RendererPortMessageSchema,
  RendererWindowMessageSchema,
  STUDIO_BRIDGE_PROTOCOL,
  STUDIO_BRIDGE_VERSION,
  StudioPortMessageSchema,
  StudioWindowMessageSchema,
  createBridgeEnvelope,
  editorQueryKeys,
  getEditorConnection,
  isBridgeEnvelope,
  withEditorConnection,
} from "./bridge.js";
export type {
  EditorConnection,
  RendererPortMessage,
  RendererWindowMessage,
  SceneDocumentSnapshot,
  SceneNodeSnapshot,
  StudioBridgeEnvelope,
  StudioPortMessage,
  StudioWindowMessage,
} from "./bridge.js";

export type { DirectiveDefinition } from "@json-render/core";
