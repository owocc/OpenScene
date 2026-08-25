import { openSceneManifestPlugin } from "@openscene-ai/solid/v2/vite";
import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, lazyPlugins, loadEnv } from "vite-plus";
// Import from the no-JSX manifest file — safe for vite config bundling.
import { createManifest } from "./src/openscene-manifest.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const manifest = createManifest(env.VITE_OPENSCENE_APP_KEY || "solid-v2");

  return {
    plugins: lazyPlugins(() => [solid(), tailwindcss(), openSceneManifestPlugin({ manifest })]),
    resolve: {
      alias: { "@": new URL("./src", import.meta.url).pathname },
    },
  };
});
