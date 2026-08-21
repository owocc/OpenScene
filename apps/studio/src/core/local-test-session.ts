import type { AppDocument } from "./document";
import type { AppMaterialManifest } from "./material-manifest";
import type { StudioBootstrap } from "./studio-bootstrap";

export const LOCAL_TEST_SESSION_ID = "local-test";

const localDocument: AppDocument = {
  schemaVersion: "1.0",
  pageInfo: {
    title: "Local Test Page",
    description: "A development-only empty AppDocument for testing Studio.",
    keywords: ["local", "studio", "test"],
    locale: "en-US",
    metadata: {},
  },
  globalConfig: {
    design: { width: 1280 },
    body: {},
    variables: {},
  },
  spec: {
    root: "",
    elements: {},
    state: {
      i18n: {
        "en-US": {
          "local.title": "Local iframe preview",
          "local.subtitle": "Rendered by the target App test page.",
          "local.button": "Try the button",
        },
        "zh-CN": {
          "local.title": "本地 iframe 预览",
          "local.subtitle": "由目标 App 测试页面渲染。",
          "local.button": "试试这个按钮",
        },
      },
      status: "ready",
    },
  },
};

const localManifest: AppMaterialManifest = {
  protocolVersion: "1.0",
  app: { key: "local-test-app", version: "dev" },
  components: {
    Stack: {
      title: "Stack",
      category: "Layout",
      slots: ["default"],
      props: {
        direction: {
          title: "Direction",
          enum: ["vertical", "horizontal"],
          default: "vertical",
        },
        gap: {
          title: "Gap",
          type: "number",
          default: 16,
          "x-editor": { control: "number", minimum: 0, step: 1 },
        },
      },
    },
    Card: {
      title: "Card",
      category: "Layout",
      slots: ["default", "footer"],
      props: {
        padding: {
          title: "Padding",
          type: "number",
          default: 24,
          "x-editor": { control: "number", minimum: 0, step: 1 },
        },
      },
    },
    Text: {
      title: "Text",
      category: "Content",
      props: {
        text: {
          title: "Text",
          type: "string",
          default: { $t: "/i18n/$lang/local.title" },
          translatable: true,
          dynamic: ["state", "template", "i18n"],
          "x-editor": { control: "textarea" },
        },
        color: {
          title: "Color",
          type: "color",
          default: "#0f172a",
          "x-editor": { control: "color" },
        },
        fontSize: {
          title: "Font size",
          type: "number",
          default: 24,
          "x-editor": { control: "number", minimum: 10, maximum: 80, step: 1 },
        },
      },
    },
    Button: {
      title: "Button",
      category: "Content",
      props: {
        label: {
          title: "Label",
          type: "string",
          default: { $t: "/i18n/$lang/local.button" },
          translatable: true,
          dynamic: ["state", "template", "i18n"],
          "x-editor": { control: "text" },
        },
        variant: {
          title: "Variant",
          enum: ["solid", "outline"],
          default: "solid",
        },
        disabled: { title: "Disabled", type: "boolean", default: false },
      },
    },
    Input: {
      title: "Input",
      category: "Form",
      props: {
        value: {
          title: "Value",
          type: "string",
          default: "Type here",
          dynamic: ["bindState", "state", "template"],
          "x-editor": { control: "text" },
        },
        placeholder: {
          title: "Placeholder",
          type: "string",
          default: "Type here",
          "x-editor": { control: "text" },
        },
      },
    },
  },
};

export function createLocalTestBootstrap(origin = "http://localhost:5174"): StudioBootstrap {
  const baseOrigin = (origin || "http://localhost:5174").replace(/\/$/, "");
  return {
    session: {
      id: LOCAL_TEST_SESSION_ID,
      expiresAt: "2099-12-31T23:59:59.000Z",
    },
    app: {
      id: "local-test-app",
      key: "local-test-app",
      name: "Local Test App",
    },
    resource: {
      id: "local-page",
      kind: "page",
      title: "Local Test Page",
      documentId: "local-document",
    },
    draft: {
      revision: 1,
      document: localDocument,
    },
    manifest: localManifest,
    preview: {
      url: `${baseOrigin}/`,
      allowedOrigin: baseOrigin,
      profileId: "local-test",
    },
    capabilities: {
      saveDraft: false,
      createVersion: false,
      publish: false,
      uploadAsset: false,
    },
    returnUrl: `${baseOrigin}/`,
  };
}
