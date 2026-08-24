import { describe, expect, it } from "vite-plus/test";

import {
  AppManifestSchema,
  RendererPortMessageSchema,
  RendererWindowMessageSchema,
  RuntimePageDeliverySchema,
  SCENE_DOCUMENT_SCHEMA_VERSION,
  SceneDocumentSchema,
  StudioPortMessageSchema,
  StudioWindowMessageSchema,
  createEmptySceneDocument,
  editorQueryKeys,
  getEditorConnection,
  withEditorConnection,
} from "./index.js";

function bridge(type: string, payload: unknown) {
  return { protocol: "openscene-studio", version: 2, sessionId: "session-1", type, payload };
}

describe("canonical scene documents", () => {
  it("creates a schema-valid empty document without a root", () => {
    const document = createEmptySceneDocument();

    expect(SceneDocumentSchema.safeParse(document).success).toBe(true);
    expect(document.schemaVersion).toBe(SCENE_DOCUMENT_SCHEMA_VERSION);
    expect(document.spec.root).toBeNull();
    expect(document.spec.elements).toEqual({});
  });

  it("accepts json-render element references and rejects dangling edges", () => {
    const document = createEmptySceneDocument();
    document.spec.root = "root";
    document.spec.elements.root = { type: "View", props: {}, children: [] };
    document.spec.elements.root.slots = { header: ["header"] };
    document.spec.elements.header = {
      type: "Text",
      props: { text: "Hello" },
      visible: true,
      on: { press: { action: "noop" } },
      repeat: { statePath: "/items" },
      watch: { "/value": { action: "noop" } },
    };

    expect(SceneDocumentSchema.safeParse(document).success).toBe(true);

    document.spec.elements.root.children = ["missing"];
    expect(SceneDocumentSchema.safeParse(document).success).toBe(false);
  });

  it("rejects a root id that is not present in elements", () => {
    const document = createEmptySceneDocument();
    document.spec.root = "missing";
    document.spec.elements.root = { type: "View", props: {}, children: [] };
    expect(SceneDocumentSchema.safeParse(document).success).toBe(false);
  });

  it("rejects adapter identity and reserved runtime state fields", () => {
    const propsDocument = createEmptySceneDocument();
    propsDocument.spec.root = "root";
    propsDocument.spec.elements.root = { type: "View", props: {}, children: [] };
    propsDocument.spec.elements.root.props.__opensceneNodeId = "root";
    expect(SceneDocumentSchema.safeParse(propsDocument).success).toBe(false);

    const stateDocument = createEmptySceneDocument();
    stateDocument.spec.root = "root";
    stateDocument.spec.elements.root = { type: "View", props: {}, children: [] };
    stateDocument.spec.state = { __scene: { pageInfo: {} } };
    expect(SceneDocumentSchema.safeParse(stateDocument).success).toBe(false);
    const identityDocument = createEmptySceneDocument();
    identityDocument.spec.root = "root";
    identityDocument.spec.elements.root = { type: "View", props: {}, children: [] };
    Object.assign(identityDocument.spec.elements.root, { id: "root" });
    expect(SceneDocumentSchema.safeParse(identityDocument).success).toBe(false);
  });
});

describe("manifest and runtime delivery", () => {
  it("requires the shared app type and validates the minimal delivery", () => {
    const manifest = {
      protocolVersion: "2.0.0",
      app: { key: "solid-v1", type: "web" },
      components: {
        Button: {
          title: "Button",
          description: "A clickable control",
          category: "actions",
          tags: ["interactive"],
          props: { type: "object", properties: {} },
          editor: { searchable: true },
          events: { press: {} },
          children: false,
          capabilities: { interactive: true },
        },
      },
    };
    expect(AppManifestSchema.safeParse(manifest).success).toBe(true);
    expect(
      AppManifestSchema.safeParse({ ...manifest, app: { key: "solid-v1", type: "native" } })
        .success,
    ).toBe(false);

    const delivery = {
      app: { id: "app-1", key: "solid-v1", type: "web" },
      page: { id: "page-1", key: "home", title: "Home" },
      document: createEmptySceneDocument(),
      release: { id: "release-1" },
    };
    expect(RuntimePageDeliverySchema.safeParse(delivery).success).toBe(true);
  });
});

describe("bridge v2 directional schemas", () => {
  it("validates each transport direction with concrete payloads", () => {
    expect(
      RendererWindowMessageSchema.safeParse(bridge("RENDERER_READY", { appType: "web" })).success,
    ).toBe(true);
    expect(StudioWindowMessageSchema.safeParse(bridge("STUDIO_CONNECT", undefined)).success).toBe(
      true,
    );
    expect(
      StudioPortMessageSchema.safeParse(
        bridge("DOCUMENT_SET", { document: createEmptySceneDocument(), revision: 3 }),
      ).success,
    ).toBe(true);
    expect(
      StudioPortMessageSchema.safeParse(
        bridge("EDITOR_STATE_SET", { interactionMode: "select", selectedElementIds: ["root"] }),
      ).success,
    ).toBe(true);
    expect(
      RendererPortMessageSchema.safeParse(
        bridge("DOCUMENT_RENDERED", { schemaVersion: "1.0.0", root: "root" }),
      ).success,
    ).toBe(true);
    expect(
      RendererPortMessageSchema.safeParse(
        bridge("SELECTION_CHANGED", {
          elementIds: [],
          primaryElementId: null,
          source: "click",
          rects: {},
        }),
      ).success,
    ).toBe(true);
    expect(
      RendererPortMessageSchema.safeParse(
        bridge("SELECTION_CHANGED", {
          elementIds: ["text-1"],
          primaryElementId: "text-1",
          source: "click",
          rects: { "text-1": { left: 0, top: 0, width: 10, height: 20 } },
        }),
      ).success,
    ).toBe(true);
    expect(
      RendererPortMessageSchema.safeParse(
        bridge("ELEMENT_HOVER", {
          elementId: "text-1",
          rect: { left: 5, top: 5, width: 40, height: 16 },
        }),
      ).success,
    ).toBe(true);
    expect(
      RendererPortMessageSchema.safeParse(bridge("ELEMENT_HOVER", { elementId: null, rect: null }))
        .success,
    ).toBe(true);
    expect(
      RendererPortMessageSchema.safeParse(bridge("ELEMENT_HOVER", { elementId: "", rect: null }))
        .success,
    ).toBe(false);
    expect(
      RendererPortMessageSchema.safeParse(
        bridge("ELEMENT_GEOMETRY", {
          elementId: "text-1",
          rect: { left: 0, top: 0, width: 100, height: 50 },
          scrollLeft: 0,
          scrollTop: 0,
        }),
      ).success,
    ).toBe(true);
    expect(
      RendererPortMessageSchema.safeParse(
        bridge("FRAME_SCROLL", { scrollLeft: 40, scrollTop: 120 }),
      ).success,
    ).toBe(true);
    expect(
      StudioPortMessageSchema.safeParse(bridge("ELEMENT_GEOMETRY_REQUEST", { elementId: "text-1" }))
        .success,
    ).toBe(true);
    expect(
      RendererPortMessageSchema.safeParse(
        bridge("SELECTION_CHANGED", {
          elementIds: ["text-1"],
          primaryElementId: "text-1",
          source: "click",
          rects: { "text-1": { left: 0, top: 0, width: -5, height: 20 } },
        }),
      ).success,
    ).toBe(false);
    expect(
      RendererPortMessageSchema.safeParse(bridge("RENDERER_ERROR", { message: "render failed" }))
        .success,
    ).toBe(true);
    expect(
      RendererWindowMessageSchema.safeParse({
        ...bridge("RENDERER_READY", { appType: "web" }),
        version: 1,
      }).success,
    ).toBe(false);
  });
});

describe("editor connection query helpers", () => {
  it("keeps the three query keys and rejects missing or non-origin sessions", () => {
    const query = new URLSearchParams({
      [editorQueryKeys.enabled]: "1",
      [editorQueryKeys.studioOrigin]: "https://studio.example.test",
      [editorQueryKeys.sessionId]: "session-1",
    }).toString();
    expect(getEditorConnection(`?${query}`)).toEqual({
      studioOrigin: "https://studio.example.test",
      sessionId: "session-1",
    });
    expect(
      getEditorConnection(
        `?${editorQueryKeys.enabled}=1&${editorQueryKeys.studioOrigin}=https%3A%2F%2Fstudio.example.test`,
      ),
    ).toBeNull();
    expect(
      getEditorConnection(
        `?${editorQueryKeys.enabled}=1&${editorQueryKeys.studioOrigin}=javascript%3Aalert(1)&${editorQueryKeys.sessionId}=session-1`,
      ),
    ).toBeNull();

    const url = withEditorConnection("https://renderer.example.test/app", {
      studioOrigin: "https://studio.example.test",
      sessionId: "session-1",
    });
    const result = new URL(url);
    expect(result.searchParams.get(editorQueryKeys.enabled)).toBe("1");
    expect(result.searchParams.get(editorQueryKeys.studioOrigin)).toBe(
      "https://studio.example.test",
    );
    expect(result.searchParams.get(editorQueryKeys.sessionId)).toBe("session-1");
  });
});
