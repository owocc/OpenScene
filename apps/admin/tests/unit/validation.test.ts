import { describe, expect, test } from "vite-plus/test";
import { ManifestSchema, SceneDocumentSchema } from "../../server/validation/schemas";
import { assetObjectKey, releaseObjectKey, safeFileName } from "../../server/storage/keys";

describe("runtime schemas", () => {
  test("accepts explicit content metadata without guessing from property names", () => {
    const manifest = ManifestSchema.parse({
      protocolVersion: "1.0",
      app: { key: "demo" },
      components: {
        Hero: {
          props: {
            label: { type: "string" },
            title: { type: "string", meta: { content: true, kind: "text" } },
          },
        },
      },
    });
    expect(manifest.components.Hero.props?.label.meta?.content).toBeUndefined();
    expect(manifest.components.Hero.props?.title.meta?.content).toBe(true);
  });

  test("requires a document schema version", () => {
    expect(() => SceneDocumentSchema.parse({ spec: {} })).toThrow();
    expect(SceneDocumentSchema.parse({ schemaVersion: "1.0.0", spec: {} }).schemaVersion).toBe(
      "1.0.0",
    );
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
