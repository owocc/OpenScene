import { describe, expect, it } from "vite-plus/test";

import { createLocalTestBootstrap, LOCAL_TEST_SESSION_ID } from "./local-test-session";

describe("Studio local test session", () => {
  it("starts from an empty document and supplies an App-owned preview contract", () => {
    const bootstrap = createLocalTestBootstrap("http://127.0.0.1:5174/");

    expect(bootstrap.session.id).toBe(LOCAL_TEST_SESSION_ID);
    expect(bootstrap.draft.document.spec).toEqual({
      root: "",
      elements: {},
      state: expect.any(Object),
    });
    expect(Object.keys(bootstrap.manifest?.components ?? {})).toEqual([
      "Stack",
      "Card",
      "Text",
      "Button",
      "Input",
    ]);
    expect(bootstrap.preview).toEqual({
      url: "http://127.0.0.1:5174/",
      allowedOrigin: "http://127.0.0.1:5174",
      profileId: "local-test",
    });
    expect(bootstrap.capabilities.saveDraft).toBe(false);
  });
});
