import { describe, expect, it } from "vite-plus/test";
import { APP_TYPE_WEB } from "@openscene-ai/constants";

import { createLocalTestBootstrap, LOCAL_TEST_SESSION_ID } from "./local-test-session";

describe("Studio local test session", () => {
  it("uses the canonical empty document and real Solid example preview", () => {
    const bootstrap = createLocalTestBootstrap("http://127.0.0.1:5174/");
    expect(bootstrap.session.id).toBe(LOCAL_TEST_SESSION_ID);
    expect(bootstrap.app.type).toBe(APP_TYPE_WEB);
    expect(bootstrap.draft.document.schemaVersion).toBe("1.0.0");
    expect(bootstrap.draft.document.spec.root).toBeNull();
    expect(bootstrap.draft.document.spec.elements).toEqual({});
    expect(bootstrap.manifest).toBeNull();
    expect(bootstrap.preview).toEqual({
      url: "http://127.0.0.1:5174/",
      allowedOrigin: "http://127.0.0.1:5174",
      profileId: "local-test",
    });
    expect(bootstrap.capabilities.saveDraft).toBe(false);
  });
});
