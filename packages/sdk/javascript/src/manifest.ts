import {
  AppManifestSchema,
  type AppManifest,
  type ComponentManifest,
} from "@openscene-ai/protocol";

/** Validate and normalize the one manifest shared by runtime and build push. */
export function defineAppManifest(manifest: AppManifest): AppManifest {
  return AppManifestSchema.parse(manifest);
}

/** Build a serializable component manifest without adapter runtime functions. */
export function defineComponentManifest(manifest: ComponentManifest): ComponentManifest {
  return { ...manifest };
}
