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
  ElementRect,
  RendererPortMessage,
  RendererWindowMessage,
  SceneDocumentSnapshot,
  SceneNodeSnapshot,
  StudioBridgeEnvelope,
  StudioPortMessage,
  StudioWindowMessage,
} from "./bridge.js";

export { DraftRecordSchema } from "./draft-store.js";
export type { DocumentDraftStore, DraftRecord } from "./draft-store.js";

export type { DirectiveDefinition } from "@json-render/core";
export {
  ActionTargetSchema,
  AgentUiActionPlanSchema,
  AgentUiActionSchema,
  DeleteElementActionSchema,
  InsertElementActionSchema,
  ReplaceDocumentActionSchema,
  UIElementDataSchema,
  UpdateElementActionSchema,
  applyAgentUiActionsToDocument,
  extractAgentUiActions,
  normalizeAiDocument,
  splitContentAndUiActions,
} from "./agent-action.js";
export type {
  AgentUiAction,
  AgentUiActionPlan,
  DeleteElementAction,
  InsertElementAction,
  ReplaceDocumentAction,
  UpdateElementAction,
  ParsedAgentMessage,
} from "./agent-action.js";
