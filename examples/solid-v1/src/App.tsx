import type { OpenSceneClient } from "@openscene-ai/javascript";
import { OpenSceneProvider, OpenSceneRenderer } from "@openscene-ai/solid";
import type { SolidApp } from "./openscene.tsx";

interface AppProps {
  client: OpenSceneClient;
  app: SolidApp;
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
