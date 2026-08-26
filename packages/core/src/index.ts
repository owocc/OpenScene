export * from "./constants.ts";

export {
  SCENE_DOCUMENT_SCHEMA_VERSION,
  SceneDocumentSchema,
  createEmptySceneDocument,
} from "./document.ts";
export type {
  SceneDocument,
  SceneGlobalConfig,
  ScenePageInfo,
  Spec,
  UIElement,
} from "./document.ts";

export {
  AppManifestSchema,
  ComponentManifestSchema,
  PublishedSceneDocumentSchema,
  RuntimePageDeliverySchema,
  SceneManifestSchema,
} from "./manifest.ts";
export type {
  AppManifest,
  ComponentManifest,
  PublishedSceneDocument,
  RuntimePageDelivery,
  SceneManifest,
} from "./manifest.ts";

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
} from "./bridge.ts";
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
} from "./bridge.ts";

export { DraftRecordSchema } from "./draft-store.ts";
export type { DocumentDraftStore, DraftRecord } from "./draft-store.ts";

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
} from "./agent-action.ts";
export type {
  AgentUiAction,
  AgentUiActionPlan,
  DeleteElementAction,
  InsertElementAction,
  ReplaceDocumentAction,
  UpdateElementAction,
  ParsedAgentMessage,
} from "./agent-action.ts";
