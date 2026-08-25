import { createContext, useContext, type Accessor } from "solid-js";
import type { OpenSceneClient, OpenSceneClientState } from "@openscene-ai/javascript";
import type { OpenSceneSolidApp } from "./catalog.js";

export interface OpenSceneContextValue {
  client: OpenSceneClient;
  app: OpenSceneSolidApp;
  snapshot: Accessor<OpenSceneClientState>;
  /** Live document revision pushed by the Studio over the bridge. */
  revision: Accessor<number | null>;
}

export const OpenSceneContext = createContext<OpenSceneContextValue>();

export function useOpenScene(): OpenSceneContextValue {
  const value = useContext(OpenSceneContext);
  if (value) return value;
  throw new Error("useOpenScene must be called inside OpenSceneProvider");
}
