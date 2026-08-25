import type { OpenSceneClient } from "@openscene/javascript";
import { OpenSceneProvider, OpenSceneRenderer } from "@openscene/react";
import type { ReactApp } from "./openscene.tsx";
import "./App.css";

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
