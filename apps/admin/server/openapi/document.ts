import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry";

export function createOpenApiDocument(): Record<string, unknown> {
  const generated = new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: "3.0.3",
    info: {
      title: "OpenScene Admin API",
      version: "1.0.0",
      description: "Multi-App content and runtime delivery API.",
    },
    servers: [{ url: "/" }],
    tags: [
      { name: "System" },
      { name: "Authentication" },
      { name: "Apps" },
      { name: "Preview Profiles" },
      { name: "Manifest" },
      { name: "Pages" },
      { name: "Templates" },
      { name: "Documents" },
      { name: "Versions" },
      { name: "Releases" },
      { name: "Categories" },
      { name: "Locales" },
      { name: "Assets" },
      { name: "OpenAPI Docs" },
      { name: "Studio Sessions" },
      { name: "Runtime" },
    ],
  });
  const paths = Object.fromEntries(
    Object.entries(generated.paths ?? {}).sort(([a], [b]) => a.localeCompare(b)),
  );
  const componentSchemas = Object.fromEntries(
    Object.entries(generated.components?.schemas ?? {}).sort(([a], [b]) => a.localeCompare(b)),
  );
  return {
    ...generated,
    paths,
    components: { ...generated.components, schemas: componentSchemas },
  };
}
