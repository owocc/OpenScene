import { Renderer } from "./lib/render/renderer.tsx";

/** The host application only mounts the OpenScene renderer. */
function App() {
  return <Renderer />;
}

export default App;
