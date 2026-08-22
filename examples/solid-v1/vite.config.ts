import { createRequire } from "node:module";
import { openSceneManifestPlugin } from "@openscene/javascript/vite";
import { defineConfig, lazyPlugins, loadEnv } from "vite-plus";
import solid from "vite-plugin-solid";
import { createManifest } from "./src/openscene.tsx";

const require = createRequire(import.meta.url);
// Force the browser build of solid-js/web: require.resolve() follows the
// node condition and returns the server entry (server.cjs / server.js),
// which would ship the server runtime to the browser.
const solidWeb = require
  .resolve("solid-js/package.json")
  .replace(/package\.json$/, "web/dist/web.js");

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
