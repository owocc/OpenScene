import { openSceneManifestPlugin } from "@openscene-ai/javascript/vite";
import { defineConfig, lazyPlugins, loadEnv } from "vite-plus";
import solid from "@solidjs/vite-plugin";
import { createManifest } from "./src/openscene.tsx";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const manifest = createManifest(env.VITE_OPENSCENE_APP_KEY);
  return {
    plugins: lazyPlugins(() => [solid(), openSceneManifestPlugin({ manifest })]),
  };
});
