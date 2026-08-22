import { createRequire } from "node:module";
import { defineConfig, lazyPlugins } from "vite-plus";
import solid from "vite-plugin-solid";

const require = createRequire(import.meta.url);
// Force the browser build of solid-js/web: require.resolve() follows the
// node condition and returns the server entry (server.cjs / server.js),
// which would ship the server runtime to the browser.
const solidWeb = require
  .resolve("solid-js/package.json")
  .replace(/package\.json$/, "web/dist/web.js");

export default defineConfig({
  plugins: lazyPlugins(() => [solid()]),
  resolve: {
    alias: {
      "solid-js/web": solidWeb,
    },
  },
  ssr: {
    noExternal: ["@json-render/solid"],
  },
  pack: {
    entry: ["src/index.tsx", "src/server.ts"],
    dts: {
      tsgo: true,
    },
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
