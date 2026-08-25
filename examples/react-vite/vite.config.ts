import { openSceneManifestPlugin } from "@openscene-ai/react/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins, loadEnv } from "vite-plus";
import { createManifest } from "./src/openscene.tsx";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const manifest = createManifest(env.VITE_OPENSCENE_APP_KEY || "react-vite");

  return {
    lint: {
      plugins: ["react", "typescript", "oxc"],
      rules: {
        "react/rules-of-hooks": "error",
        "react/only-export-components": [
          "warn",
          {
            allowConstantExport: true,
          },
        ],
        "vite-plus/prefer-vite-plus-imports": "error",
      },
      options: {
        typeAware: true,
        typeCheck: true,
      },
      jsPlugins: [
        {
          name: "vite-plus",
          specifier: "vite-plus/oxlint-plugin",
        },
      ],
    },
    plugins: lazyPlugins(() => [react(), openSceneManifestPlugin({ manifest })]),
  };
});
