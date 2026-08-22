import { createRequire } from "node:module";
import { defineConfig, lazyPlugins } from "vite-plus";
import solid from "vite-plugin-solid";

const require = createRequire(import.meta.url);
const solidWeb = require.resolve("solid-js/web").replace(/server\.js$/, "web.js");

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
