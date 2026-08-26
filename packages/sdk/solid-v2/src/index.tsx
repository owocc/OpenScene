// Catalog / factory exports
export {
  defineOpenSceneSolidComponent,
  defineOpenSceneSolidAction,
  defineOpenSceneSolidApp,
  defineOpenSceneComponent,
  defineOpenSceneAction,
  defineOpenSceneApp,
  buildOpenApiRequest,
  executeOpenApiRequest,
  defineOpenApiRequestAction,
} from "./catalog.ts";
export { baseComponents, baseSolidComponents } from "./base-components.tsx";
export type {
  SolidRenderer,
  OpenSceneSolidComponentDefinition,
  OpenSceneSolidActionDefinition,
  OpenSceneSolidApp,
  DefineOpenSceneSolidAppOptions,
  OpenApiRequest,
} from "./catalog.ts";

// Context
export { useRuntime, RuntimeProvider } from "./runtime-ctx.tsx";
export type { RuntimeContextValue, RuntimeProviderProps } from "./runtime-ctx.tsx";

// Renderer
export { DocumentRenderer } from "./doc-renderer.tsx";
export type { DocumentRendererProps } from "./doc-renderer.tsx";
export { Button, OpenSceneNodeProvider, Text, useOpenSceneNode, View } from "./node.tsx";
export type { OpenSceneNodeContextValue, PrimitiveProps } from "./node.tsx";

// Provider
export { OpenSceneProvider, OpenSceneStandalone, installDevManifest } from "./provider.tsx";
export type { OpenSceneProviderProps, OpenSceneStandaloneProps } from "./provider.tsx";

// Re-exports from @openscene-ai/javascript
export {
  installOpenScene,
  OpenSceneController,
  createIndexedDbDraftStore,
  defineAppManifest,
  defineComponentManifest,
  evaluateDynamicValue,
} from "@openscene-ai/javascript";
export type {
  DeepReadonly,
  OpenSceneClient,
  OpenSceneClientOptions,
  OpenSceneClientState,
  OpenSceneInteractionMode,
  OpenSceneStatus,
  SelectionReport,
} from "@openscene-ai/javascript";

// Schema
export { openApiMethods, type OpenApiMethod, type OpenApiValue } from "@openscene-ai/schema";

// Protocol
export {
  SCENE_DOCUMENT_SCHEMA_VERSION,
  SceneDocumentSchema,
  createEmptySceneDocument,
  AppManifestSchema,
  ComponentManifestSchema,
  RuntimePageDeliverySchema,
} from "@openscene-ai/core";
export type {
  AppManifest,
  ComponentManifest,
  RuntimePageDelivery,
  SceneDocument,
  SceneGlobalConfig,
  ScenePageInfo,
  Spec,
  UIElement,
} from "@openscene-ai/core";

// Constants
export {
  APP_TYPE_WEB,
  APP_TYPE_FLUTTER,
  APP_TYPE_REACT_NATIVE,
  APP_TYPES,
  COMPONENT_DRAG_MIME,
} from "@openscene-ai/core";
export type { AppType } from "@openscene-ai/core";
