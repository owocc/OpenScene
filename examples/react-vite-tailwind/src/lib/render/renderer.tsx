import { OpenScene } from "@openscene-ai/react";
import { reactActions, reactComponents } from "../../openscene.tsx";

export function Renderer() {
  return (
    <OpenScene
      baseUrl={import.meta.env.VITE_OPENSCENE_BASE_URL}
      components={reactComponents}
      actions={reactActions}
    />
  );
}
