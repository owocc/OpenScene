import { defineConfig } from "vite-plus";
import solid from "vite-plugin-solid";
import { lazyPlugins } from "vite-plus";

export default defineConfig({
  plugins: lazyPlugins(() => [solid()]),
});
