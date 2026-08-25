/* @refresh reload */
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import {
  installOpenScene,
  OpenSceneProvider,
  installDevManifest,
  type OpenSceneClient,
} from "@openscene-ai/solid";
import { app } from "./openscene.tsx";
import "./index.css";

function EditorModeApp(): JSX.Element {
  const [client, setClient] = createSignal<OpenSceneClient | null>(null);

  createEffect(() => {
    const c = installOpenScene({
      apiBaseUrl: import.meta.env.VITE_OPENSCENE_API_URL ?? "",
      pageKey: import.meta.env.VITE_OPENSCENE_PAGE_KEY ?? "index",
      manifest: app.manifest,
    });

    // Push manifest to Studio for local dev component discovery.
    const cleanup = installDevManifest(app.manifest);
    setClient(c);
    onCleanup(cleanup);
  });

  return (
    <Show when={client()}>
      {(c: () => OpenSceneClient) => (
        <div class="min-h-screen bg-[#131729] text-white">
          <OpenSceneProvider app={app} client={c()} />
        </div>
      )}
    </Show>
  );
}

export default function App(): JSX.Element {
  return <EditorModeApp />;
}
