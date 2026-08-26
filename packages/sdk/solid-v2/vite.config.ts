import { defineConfig, lazyPlugins } from "vite-plus";
import solid from "vite-plugin-solid";
import type { Plugin } from "vite-plus";

const solidV2Compat: Plugin = {
  name: "openscene:solid-v2-compat",
  enforce: "post",
  transform(code) {
    if (!code.includes("solid-js/web")) return null;
    return { code: code.replaceAll('"solid-js/web"', '"@solidjs/web"'), map: null };
  },
};

export default defineConfig({
  plugins: lazyPlugins(() => [solid(), solidV2Compat]),
  pack: {
    entry: ["src/index.tsx", "src/server.ts", "src/vite.ts"],
    dts: true,
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {},
});
