import { describe, expect, it } from "vite-plus/test";
import {
  createManifest,
  Image,
  imageProps,
  Callout,
  StatusCard,
  OpenApiProvider,
  setNotice,
  reactComponents,
  reactActions,
} from "./openscene.tsx";

describe("React Vite OpenScene integration", () => {
  it("defines image props with editor-friendly values", () => {
    const parsed = imageProps.parse({
      src: "https://example.com/photo.png",
      alt: "Sample photo",
      fit: "cover",
      loading: "lazy",
      className: "custom-img",
      style: { width: "300px", height: "200px", borderRadius: "8px" },
    });

    expect(parsed.src).toBe("https://example.com/photo.png");
    expect(parsed.alt).toBe("Sample photo");
    expect(parsed.fit).toBe("cover");
    expect(parsed.loading).toBe("lazy");
    expect(parsed.className).toBe("custom-img");
    expect(parsed.style).toEqual({ width: "300px", height: "200px", borderRadius: "8px" });
  });

  it("includes component and action definitions in the catalog manifest", () => {
    expect(Image.type).toBe("Image");
    expect(Callout.type).toBe("Callout");
    expect(StatusCard.type).toBe("StatusCard");
    expect(OpenApiProvider.type).toBe("OpenApiProvider");
    expect(setNotice.key).toBe("reactViteSetNotice");
    expect(reactComponents).toHaveLength(4);
    expect(reactActions).toHaveLength(2);

    const manifest = createManifest();
    expect(manifest.appType).toBe("web");
    expect(manifest.components.Image).toBeDefined();
    expect(manifest.components.Image.title).toBe("Image");
    expect(manifest.components.Image.category).toBe("media");
    expect(manifest.components.Callout).toBeDefined();
    expect(manifest.components.StatusCard).toBeDefined();
    expect(manifest.components.OpenApiProvider).toBeDefined();
    expect(manifest.actions?.reactViteSetNotice).toBeDefined();
    expect("app" in manifest).toBe(false);
  });
});
