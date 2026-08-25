export {
  SCENE_DOCUMENT_SCHEMA_VERSION,
  SceneDocumentSchema,
  createEmptySceneDocument,
} from "./document";
export type { SceneDocument, SceneGlobalConfig, ScenePageInfo, Spec, UIElement } from "./document";

export { AppManifestSchema, ComponentManifestSchema, RuntimePageDeliverySchema } from "./manifest";
export type { AppManifest, ComponentManifest, RuntimePageDelivery } from "./manifest";

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
} from "./bridge";
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
} from "./bridge";

export { DraftRecordSchema } from "./draft-store";
export type { DocumentDraftStore, DraftRecord } from "./draft-store";

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
} from "./agent-action";
export type {
  AgentUiAction,
  AgentUiActionPlan,
  DeleteElementAction,
  InsertElementAction,
  ReplaceDocumentAction,
  UpdateElementAction,
  ParsedAgentMessage,
} from "./agent-action";
