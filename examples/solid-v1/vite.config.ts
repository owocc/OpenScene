import { createRequire } from "node:module";
import { openSceneManifestPlugin } from "@openscene/javascript/vite";
import { defineConfig, lazyPlugins, loadEnv } from "vite-plus";
import solid from "vite-plugin-solid";
import { createManifest } from "./src/openscene.tsx";

const require = createRequire(import.meta.url);
const solidWeb = require.resolve("solid-js/web").replace(/server\.js$/u, "web.js");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const manifest = createManifest(env.VITE_OPENSCENE_APP_KEY);
  return {
    resolve: {
      alias: {
        "solid-js/web": solidWeb,
      },
    },
    plugins: lazyPlugins(() => [solid(), openSceneManifestPlugin({ manifest })]),
  };
});
