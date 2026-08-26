import { OpenSceneProvider, OpenSceneRenderer, type OpenSceneClient } from "@openscene-ai/react";
import type { ReactApp } from "./openscene.tsx";

interface AppProps {
  client: OpenSceneClient;
  app: ReactApp;
}

/** The example owns no page document; Admin release or Studio supplies it at runtime. */
function App(props: AppProps) {
  return (
    <OpenSceneProvider client={props.client} app={props.app}>
      <OpenSceneRenderer />
    </OpenSceneProvider>
  );
}

export default App;
