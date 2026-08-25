import { describe, expect, it } from "vite-plus/test";
import { createSolidApp, createManifest, Image, imageProps, baseViewProps } from "./openscene.tsx";

describe("examples/solid-vite Image component", () => {
  it("defines baseViewProps with style editor metadata", () => {
    expect(baseViewProps.class).toBeDefined();
    expect(baseViewProps.className).toBeDefined();
    expect(baseViewProps.style).toBeDefined();

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

  it("includes Image component in manifest and catalog", () => {
    expect(Image).toBeDefined();
    expect(Image.type).toBe("Image");

    const app = createSolidApp("test-app");
    expect(app.catalog.componentNames).toContain("Image");
    expect(app.componentDefinitions.Image).toBeDefined();
    expect(app.componentDefinitions.Image.title).toBe("Image");
    expect(app.componentDefinitions.Image.category).toBe("media");

    const manifest = createManifest("test-app");
    expect(manifest.components.Image).toBeDefined();
    expect(manifest.components.Image.title).toBe("Image");
    expect(manifest.components.Image.category).toBe("media");
    expect(manifest.components.Image.props).toBeDefined();

    const propsSchema = manifest.components.Image.props as Record<string, unknown>;
    const properties = (propsSchema.properties ?? {}) as Record<string, unknown>;
    expect(properties.src).toBeDefined();
    expect(properties.alt).toBeDefined();
    expect(properties.fit).toBeDefined();
    expect(properties.loading).toBeDefined();
    expect(properties.style).toBeDefined();
    expect(properties.className).toBeDefined();
    expect(properties.class).toBeDefined();
    expect(properties.width).toBeUndefined();
    expect(properties.height).toBeUndefined();
  });
});
