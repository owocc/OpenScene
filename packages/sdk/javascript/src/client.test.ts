import { describe, expect, it, vi } from "vite-plus/test";
// @ts-expect-error jsdom ships no type declarations
import { JSDOM } from "jsdom";
import {
  createBridgeEnvelope,
  createEmptySceneDocument,
  PublishedSceneDocumentSchema,
  StudioPortMessageSchema,
  type SceneDocument,
} from "@openscene-ai/core";
import { OpenSceneController, type OpenSceneClientOptions } from "./client.js";
import { createIndexedDbDraftStore } from "./draft-store.js";

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
    baseUrl: "https://cdn.example.test/app/releases/current",
    pageKey: "home",
  };
  return new OpenSceneController(options, window);
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
    expect(StudioPortMessageSchema.safeParse(envelope).success).toBe(true);
  });
});

describe("OpenScene static page loading", () => {
  it("loads a page JSON file from the configured base URL", async () => {
    const dom = new JSDOM("<!doctype html>", { url: "https://example.test/pricing" });
    const payload = {
      schemaVersion: "1",
      page: { key: "pricing", title: "Pricing" },
      document: makeDocument("STATIC-VERSION"),
    };
    expect(PublishedSceneDocumentSchema.safeParse(payload).success).toBe(true);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify(payload), { status: 200 }));
    const controller = new OpenSceneController(
      { baseUrl: "https://cdn.example.test/app", pageKey: "pricing" },
      dom.window as unknown as Window,
    );
    await controller.loadPage();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cdn.example.test/app/pricing.json",
      expect.objectContaining({ method: "GET" }),
    );
    expect(controller.getSnapshot().status).toBe("ready");
    expect(controller.getSnapshot().document?.spec.elements["text-1"].props.text).toBe(
      "STATIC-VERSION",
    );
    controller.destroy();
    fetchMock.mockRestore();
  });
});

describe("IndexedDB draft store", () => {
  it("exposes the browser-only draft store factory", () => {
    expect(createIndexedDbDraftStore).toBeTypeOf("function");
  });
});
