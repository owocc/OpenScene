import { createContext, useContext } from "react";
import type { OpenSceneClient, OpenSceneClientState } from "@openscene/javascript";
import type { OpenSceneReactApp } from "./catalog.js";

export interface OpenSceneContextValue {
  client: OpenSceneClient;
  app: OpenSceneReactApp;
  snapshot: OpenSceneClientState;
  /** Live document revision pushed by the Studio over the bridge. */
  revision: number | null;
}

export const OpenSceneContext = createContext<OpenSceneContextValue | null>(null);

export function useOpenScene(): OpenSceneContextValue {
  const value = useContext(OpenSceneContext);
  if (value) return value;
  throw new Error("useOpenScene must be called inside OpenSceneProvider");
}
