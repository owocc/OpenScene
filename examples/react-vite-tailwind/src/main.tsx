import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installOpenScene } from "@openscene-ai/react";
import "./index.css";
import App from "./App.tsx";
import { createManifest, createReactApp } from "./openscene.tsx";

const appKey = import.meta.env.VITE_OPENSCENE_APP_KEY || "react-vite";
const reactApp = createReactApp(appKey);
const manifest = createManifest(appKey);
const pageKey = decodeURIComponent(window.location.pathname.replace(/^\/+|\/+$/g, "")) || "home";

const client = installOpenScene({
  apiBaseUrl: import.meta.env.VITE_OPENSCENE_ADMIN_URL,
  pageKey,
  manifest,
});

if (typeof window !== "undefined" && window.OpenScene !== client) {
  throw new Error("OpenScene client installation did not register window.OpenScene");
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <App client={client} app={reactApp} />
  </StrictMode>,
);
