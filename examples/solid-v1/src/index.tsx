/* @refresh reload */
import { installOpenScene } from "@openscene-ai/javascript";
import { render } from "@solidjs/web";
import "./index.css";
import App from "./App.tsx";
import { createManifest, createSolidApp } from "./openscene.tsx";

const appKey = import.meta.env.VITE_OPENSCENE_APP_KEY;
const solidApp = createSolidApp(appKey);
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
render(() => <App client={client} app={solidApp} />, root!);
