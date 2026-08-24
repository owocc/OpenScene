import { APP_TYPE_WEB } from "@openscene/constants";
import { createEmptySceneDocument, type AppManifest } from "@openscene/protocol";

import type { StudioBootstrap } from "./studio-bootstrap";

export const LOCAL_TEST_SESSION_ID = "local-test";

export function createLocalTestBootstrap(origin = "http://localhost:5174"): StudioBootstrap {
  const baseOrigin = (origin || "http://localhost:5174").replace(/\/$/, "");
  const document = createEmptySceneDocument();
  return {
    session: { id: LOCAL_TEST_SESSION_ID, expiresAt: "2099-12-31T23:59:59.000Z" },
    app: { id: "local-test-app", key: "solid-v1", name: "Solid example", type: APP_TYPE_WEB },
    resource: {
      id: "local-page",
      kind: "page",
      title: "Local Test Page",
      documentId: "local-document",
      defaultPromptId: null,
    },
    draft: { revision: 1, document },
    manifest: null as AppManifest | null,
    preview: { url: `${baseOrigin}/`, allowedOrigin: baseOrigin, profileId: "local-test" },
    capabilities: { saveDraft: false, createVersion: false, publish: false, uploadAsset: false },
    returnUrl: `${baseOrigin}/`,
    prompts: [
      {
        id: "prompt-default",
        key: "default",
        name: "Default Prompt",
        isDefault: true,
        enabled: true,
      },
    ],
    locales: [
      { id: "locale-en", code: "en-US", name: "English (US)", isDefault: true },
      { id: "locale-zh", code: "zh-CN", name: "简体中文", isDefault: false },
    ],
  };
}
