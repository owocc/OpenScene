import { defineConfig, lazyPlugins } from "vite-plus";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: lazyPlugins(() => [react()]),
  pack: {
    entry: ["src/index.tsx", "src/server.ts", "src/vite.ts"],
    dts: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
