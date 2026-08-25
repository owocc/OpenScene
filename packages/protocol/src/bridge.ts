import { APP_TYPE_WEB } from "@openscene-ai/constants";
import { z } from "zod";
import {
  SCENE_DOCUMENT_SCHEMA_VERSION,
  SceneDocumentSchema,
  type SceneDocument,
} from "./document.ts";
import { AppManifestSchema } from "./manifest.ts";

/** Stable browser protocol identifier shared by Studio and renderer SDKs. */
export const STUDIO_BRIDGE_PROTOCOL = "openscene-studio" as const;
/** Breaking bridge version. */
export const STUDIO_BRIDGE_VERSION = 2 as const;

/** Query parameters that opt an iframe into Studio inspection mode. */
export const editorQueryKeys = {
  enabled: "openscene-editor",
  studioOrigin: "openscene-studio-origin",
  sessionId: "openscene-editor-session",
} as const;

export interface EditorConnection {
  studioOrigin: string;
  sessionId: string;
}

export interface StudioBridgeEnvelope<TType extends string = string, TPayload = unknown> {
  protocol: typeof STUDIO_BRIDGE_PROTOCOL;
  version: typeof STUDIO_BRIDGE_VERSION;
  sessionId: string;
  type: TType;
  payload: TPayload;
}

/**
 * Serializable runtime node detail shown by Studio's tree and property panel.
 * The element map key is the identity; the snapshot duplicates it so the
 * receiving side can address nodes without the key.
 */
export interface SceneNodeSnapshot {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children: string[];
  slots: Record<string, string[]>;
}

/** Serializable JSON-render tree snapshot sent when a renderer connects. */
export interface SceneDocumentSnapshot {
  /** Root element key; null when the document has no root yet. */
  root: string | null;
  elements: Record<string, SceneNodeSnapshot>;
  state: Record<string, unknown>;
}

/**
 * Bounding box of a rendered element, relative to the iframe viewport.
 * Studio draws the selection/hover outlines on top of the frame from these
 * coordinates, so the iframe content itself stays untouched.
 */
export interface ElementRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const ElementRectSchema = z.object({
  left: z.number().nonnegative(),
  top: z.number().nonnegative(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});

const nonEmptyString = z.string().min(1);

/** Base schema used to reject messages from another protocol/version. */
export const BridgeEnvelopeSchema = z
  .object({
    protocol: z.literal(STUDIO_BRIDGE_PROTOCOL),
    version: z.literal(STUDIO_BRIDGE_VERSION),
    sessionId: nonEmptyString,
    type: nonEmptyString,
    payload: z.unknown(),
  })
  .passthrough();

const envelope = <TType extends string, TPayload extends z.ZodType>(
  type: TType,
  payload: TPayload,
) => BridgeEnvelopeSchema.extend({ type: z.literal(type), payload });

/** iframe window → Studio window. */
export const RendererWindowMessageSchema = z.discriminatedUnion("type", [
  envelope("RENDERER_READY", z.object({ appType: z.literal(APP_TYPE_WEB) })),
]);

/** Studio window → iframe window. The MessagePort is transferred separately. */
export const StudioWindowMessageSchema = z.discriminatedUnion("type", [
  envelope("STUDIO_CONNECT", z.undefined()),
]);

/** Studio MessagePort → renderer client. */
export const StudioPortMessageSchema = z.discriminatedUnion("type", [
  envelope(
    "DOCUMENT_SET",
    z.object({
      document: SceneDocumentSchema,
      revision: z.number().int().nonnegative(),
    }),
  ),
  envelope(
    "EDITOR_STATE_SET",
    z.object({
      interactionMode: z.enum(["select", "preview"]),
      selectedElementIds: z.array(nonEmptyString),
    }),
  ),
  envelope("ELEMENT_GEOMETRY_REQUEST", z.object({ elementId: nonEmptyString })),
]);

/** Renderer client → Studio MessagePort. */
export const RendererPortMessageSchema = z.discriminatedUnion("type", [
  envelope(
    "DOCUMENT_RENDERED",
    z.object({
      schemaVersion: z.literal(SCENE_DOCUMENT_SCHEMA_VERSION),
      root: nonEmptyString.nullable(),
    }),
  ),
  envelope(
    "SELECTION_CHANGED",
    z.object({
      elementIds: z.array(nonEmptyString),
      primaryElementId: nonEmptyString.nullable(),
      source: z.enum(["click", "marquee"]),
      rects: z.record(z.string(), ElementRectSchema),
    }),
  ),
  envelope(
    "ELEMENT_HOVER",
    z.object({ elementId: nonEmptyString.nullable(), rect: ElementRectSchema.nullable() }),
  ),
  envelope(
    "ELEMENT_GEOMETRY",
    z.object({
      elementId: nonEmptyString,
      rect: ElementRectSchema,
      scrollLeft: z.number().nonnegative(),
      scrollTop: z.number().nonnegative(),
    }),
  ),
  envelope(
    "FRAME_SCROLL",
    z.object({ scrollLeft: z.number().nonnegative(), scrollTop: z.number().nonnegative() }),
  ),
  envelope("RENDERER_ERROR", z.object({ message: nonEmptyString })),
  /** Dev-mode only: renderer pushes its local manifest so Studio can populate
   *  PropertyEditor without a server upload. Only handled when sessionId is
   *  the local-test sentinel; ignored in production sessions. */
  envelope("DEV_MANIFEST", z.object({ manifest: AppManifestSchema })),
]);

export type RendererWindowMessage = z.infer<typeof RendererWindowMessageSchema>;
export type StudioWindowMessage = z.infer<typeof StudioWindowMessageSchema>;
export type StudioPortMessage = z.infer<typeof StudioPortMessageSchema>;
export type RendererPortMessage = z.infer<typeof RendererPortMessageSchema>;

/** Creates a v2 protocol envelope without exposing mutable shared state. */
export function createBridgeEnvelope<TType extends string, TPayload>(
  sessionId: string,
  type: TType,
  payload: TPayload,
): StudioBridgeEnvelope<TType, TPayload> {
  return {
    protocol: STUDIO_BRIDGE_PROTOCOL,
    version: STUDIO_BRIDGE_VERSION,
    sessionId,
    type,
    payload,
  };
}

/** Validates the stable envelope fields before a message is processed. */
export function isBridgeEnvelope(value: unknown): value is StudioBridgeEnvelope {
  return BridgeEnvelopeSchema.safeParse(value).success;
}

/** Reads and validates editor-mode connection values from a URL query string. */
export function getEditorConnection(search: string): EditorConnection | null {
  const params = new URLSearchParams(search);
  const enabled = params.get(editorQueryKeys.enabled) === "1";
  const studioOrigin = params.get(editorQueryKeys.studioOrigin);
  const sessionId = params.get(editorQueryKeys.sessionId);
  if (!enabled || !studioOrigin || !sessionId) return null;
  try {
    const parsed = new URL(studioOrigin);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.origin !== studioOrigin
    ) {
      return null;
    }
    return { studioOrigin: parsed.origin, sessionId };
  } catch {
    return null;
  }
}

/** Appends a validated Studio connection to a target iframe URL. */
export function withEditorConnection(url: string, connection: EditorConnection): string {
  const base = typeof window === "undefined" ? "http://localhost/" : window.location.href;
  const target = new URL(url, base);
  target.searchParams.set(editorQueryKeys.enabled, "1");
  target.searchParams.set(editorQueryKeys.studioOrigin, connection.studioOrigin);
  target.searchParams.set(editorQueryKeys.sessionId, connection.sessionId);
  return target.toString();
}

export type { SceneDocument };
