import { describe, expect, it } from "vite-plus/test";
import {
  createReactApp,
  createManifest,
  Image,
  imageProps,
  baseViewProps,
  Callout,
  StatusCard,
  OpenApiProvider,
  setNotice,
} from "./openscene.tsx";

describe("examples/react-vite OpenScene integration", () => {
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

  it("includes components in manifest and catalog", () => {
    expect(Image).toBeDefined();
    expect(Image.type).toBe("Image");
    expect(Callout.type).toBe("ReactViteCallout");
    expect(StatusCard.type).toBe("ReactViteStatusCard");
    expect(OpenApiProvider.type).toBe("ReactViteOpenApiProvider");
    expect(setNotice.key).toBe("reactViteSetNotice");

    const app = createReactApp("test-react-app");
    expect(app.catalog.componentNames).toContain("View");
    expect(app.catalog.componentNames).toContain("Text");
    expect(app.catalog.componentNames).toContain("Button");
    expect(app.catalog.componentNames).toContain("Image");
    expect(app.catalog.componentNames).toContain("ReactViteCallout");
    expect(app.catalog.componentNames).toContain("ReactViteStatusCard");
    expect(app.catalog.componentNames).toContain("ReactViteOpenApiProvider");

    const manifest = createManifest("test-react-app");
    expect(manifest.app.key).toBe("test-react-app");
    expect(manifest.components.Image).toBeDefined();
    expect(manifest.components.Image.title).toBe("Image");
    expect(manifest.components.Image.category).toBe("media");
    expect(manifest.components.ReactViteCallout).toBeDefined();
    expect(manifest.components.ReactViteStatusCard).toBeDefined();
    expect(manifest.components.ReactViteOpenApiProvider).toBeDefined();
    expect(manifest.actions?.reactViteSetNotice).toBeDefined();
  });
});
