import { APP_TYPE_FLUTTER, APP_TYPE_REACT_NATIVE, APP_TYPE_WEB } from "@openscene/constants";
import { describe, expect, test } from "vite-plus/test";
import {
  AppCreateSchema,
  ManifestSchema,
  SceneDocumentSchema,
} from "../../server/validation/schemas";
import { assetObjectKey, releaseObjectKey, safeFileName } from "../../server/storage/keys";

describe("runtime schemas", () => {
  test("accepts explicit content metadata without guessing from property names", () => {
    const manifest = ManifestSchema.parse({
      protocolVersion: "1.0",
      app: { key: "demo", type: APP_TYPE_WEB },
      components: {
        Hero: {
          title: "Hero",
          props: {
            label: { type: "string" },
            title: { type: "string", meta: { content: true, kind: "text" } },
          },
        },
      },
    });
    const props = manifest.components.Hero.props as {
      label: { meta?: { content?: boolean } };
      title: { meta?: { content?: boolean } };
    };
    expect(props.label.meta?.content).toBeUndefined();
    expect(props.title.meta?.content).toBe(true);
  });

  test("requires a canonical document wrapper", () => {
    expect(() => SceneDocumentSchema.parse({ spec: {} })).toThrow();
    expect(
      SceneDocumentSchema.parse({
        schemaVersion: "1.0.0",
        pageInfo: { title: "", description: "", keywords: [], locale: "en-US", metadata: {} },
        globalConfig: {},
        spec: {
          root: "root",
          elements: { root: { type: "View", props: {}, children: [] } },
          state: {},
        },
      }).schemaVersion,
    ).toBe("1.0.0");
  });
});

describe("app type schema", () => {
  test("requires a supported app type when creating an app", () => {
    expect(() => AppCreateSchema.parse({ key: "demo", name: "Demo" })).toThrow();
    expect(AppCreateSchema.parse({ key: "demo", name: "Demo", type: APP_TYPE_WEB }).type).toBe(
      APP_TYPE_WEB,
    );
    expect(
      AppCreateSchema.parse({ key: "demo", name: "Demo", type: APP_TYPE_REACT_NATIVE }).type,
    ).toBe(APP_TYPE_REACT_NATIVE);
    expect(AppCreateSchema.parse({ key: "demo", name: "Demo", type: APP_TYPE_FLUTTER }).type).toBe(
      APP_TYPE_FLUTTER,
    );
    expect(() => AppCreateSchema.parse({ key: "demo", name: "Demo", type: "native" })).toThrow();
  });
});

describe("storage keys", () => {
  test("keeps app isolation and sanitizes file names", () => {
    expect(assetObjectKey("app_a", "asset_1", "../../hero image.png")).toBe(
      "apps/app_a/assets/asset_1/hero-image.png",
    );
    expect(releaseObjectKey("app_a", "release_1")).toBe(
      "apps/app_a/releases/release_1/document.json",
    );
    expect(safeFileName("../../")).toBe("upload.bin");
  });
});
