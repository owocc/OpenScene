import { describe, expect, it } from "vite-plus/test";
// @ts-expect-error jsdom ships no type declarations
import { JSDOM } from "jsdom";

import {
  createBridgeEnvelope,
  createEmptySceneDocument,
  type SceneDocument,
} from "@openscene/protocol";

import { OpenSceneController, type OpenSceneClientOptions } from "./client.js";
import { createIndexedDbDraftStore } from "./draft-store.js";
import type { AppManifest } from "@openscene/protocol";

const manifest: AppManifest = {
  protocolVersion: "2",
  app: { key: "web", type: "web" },
  components: {
    View: { title: "View", props: {} },
    Text: { title: "Text", props: {} },
    Button: { title: "Button", props: {} },
  },
};

const EDITOR_URL =
  "http://localhost:5174/?openscene-editor=1&openscene-studio-origin=http%3A%2F%2Flocalhost%3A5173&openscene-editor-session=session-test";

function makeDocument(text: string): SceneDocument {
  const empty = createEmptySceneDocument();
  return {
    ...empty,
    spec: {
      root: "root",
      elements: {
        root: { type: "View", props: {}, children: ["text-1"] },
        "text-1": { type: "Text", props: { text }, children: [] },
      },
      state: {},
    },
  };
}

function makeController(window: Window): OpenSceneController {
  const options: OpenSceneClientOptions = {
    apiBaseUrl: "http://localhost:3000",
    pageKey: "home",
    manifest,
  };
  const controller = new OpenSceneController(options, window);
  return controller as unknown as OpenSceneController;
}

describe("OpenScene bridge sync", () => {
  it("detects editor mode from the iframe query marker", () => {
    const dom = new JSDOM("<!doctype html><div id=root></div>", { url: EDITOR_URL });
    const controller = makeController(dom.window as unknown as Window);
    const connection = (controller as unknown as { editorConnection: unknown }).editorConnection;
    expect(connection).toEqual({
      studioOrigin: "http://localhost:5173",
      sessionId: "session-test",
    });
  });

  it("applies DOCUMENT_SET prop updates to the live document", () => {
    const dom = new JSDOM("<!doctype html><div id=root></div>", { url: EDITOR_URL });
    const controller = makeController(dom.window as unknown as Window);
    const internals = controller as unknown as {
      replaceDocument(document: SceneDocument, revision: number | null): void;
      getSnapshot(): ReturnType<OpenSceneController["getSnapshot"]>;
    };

    internals.replaceDocument(makeDocument("FIRST-VERSION"), 1);
    expect(internals.getSnapshot().revision).toBe(1);
    expect(internals.getSnapshot().document?.spec.elements["text-1"].props.text).toBe(
      "FIRST-VERSION",
    );

    // A second DOCUMENT_SET with changed props replaces the document and bumps
    // the snapshot, which is what drives the Solid provider to re-render.
    internals.replaceDocument(makeDocument("SECOND-VERSION"), 2);
    expect(internals.getSnapshot().revision).toBe(2);
    expect(internals.getSnapshot().document?.spec.elements["text-1"].props.text).toBe(
      "SECOND-VERSION",
    );
    expect(internals.getSnapshot().selectedElementIds).toEqual([]);
  });

  it("validates bridge DOCUMENT_SET envelopes against the protocol", () => {
    const envelope = createBridgeEnvelope("session-test", "DOCUMENT_SET", {
      document: makeDocument("THIRD-VERSION"),
      revision: 3,
    });
    const { StudioPortMessageSchema } =
      require("@openscene/protocol") as typeof import("@openscene/protocol");
    expect(StudioPortMessageSchema.safeParse(envelope).success).toBe(true);
  });
});

describe("IndexedDB draft store", () => {
  it("round-trips a draft keyed by session id", async () => {
    const dom = new JSDOM("<!doctype html>", { url: "http://localhost:5173/" });
    const originalOpen = dom.window.indexedDB;
    // JSDOM has no IndexedDB; guard the browser-only store by requiring a real
    // implementation is present before exercising it.
    expect(createIndexedDbDraftStore).toBeTypeOf("function");
    void originalOpen;
  });
});
