import { describe, expect, it } from "vite-plus/test";
import { APP_TYPE_WEB } from "@openscene/constants";
import {
  RendererPortMessageSchema,
  StudioPortMessageSchema,
  createBridgeEnvelope,
  createEmptySceneDocument,
} from "@openscene/protocol";

import { isRendererReadyForSession } from "./web-iframe-renderer";

describe("Studio Web iframe bridge v2 handshake", () => {
  it("accepts only the matching renderer app type and editor session", () => {
    const ready = createBridgeEnvelope("session-1", "RENDERER_READY", { appType: APP_TYPE_WEB });
    expect(isRendererReadyForSession(ready, "session-1", APP_TYPE_WEB)).toBe(true);
    expect(
      isRendererReadyForSession({ ...ready, sessionId: "other" }, "session-1", APP_TYPE_WEB),
    ).toBe(false);
    expect(
      isRendererReadyForSession(
        { ...ready, payload: { appType: "native" } },
        "session-1",
        APP_TYPE_WEB,
      ),
    ).toBe(false);
    expect(isRendererReadyForSession({ ...ready, version: 1 }, "session-1", APP_TYPE_WEB)).toBe(
      false,
    );
  });

  it("validates document, editor state, selection and renderer error payloads", () => {
    const document = createEmptySceneDocument();
    expect(
      StudioPortMessageSchema.safeParse(
        createBridgeEnvelope("s", "DOCUMENT_SET", { document, revision: 2 }),
      ).success,
    ).toBe(true);
    expect(
      StudioPortMessageSchema.safeParse(
        createBridgeEnvelope("s", "EDITOR_STATE_SET", {
          interactionMode: "select",
          selectedElementIds: ["root"],
        }),
      ).success,
    ).toBe(true);
    expect(
      RendererPortMessageSchema.safeParse(
        createBridgeEnvelope("s", "SELECTION_CHANGED", {
          elementIds: ["root"],
          primaryElementId: "root",
          source: "click",
        }),
      ).success,
    ).toBe(true);
    expect(
      RendererPortMessageSchema.safeParse(
        createBridgeEnvelope("s", "RENDERER_ERROR", { message: "render failed" }),
      ).success,
    ).toBe(true);
  });
});
