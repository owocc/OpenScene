import { createContext, createSignal, useContext, type Accessor } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { OpenSceneSolidApp, OpenSceneSolidActionDefinition } from "./catalog.ts";

export interface RuntimeContextValue {
  app: OpenSceneSolidApp;
  /** Reactive accessor for current page state. */
  state: Accessor<Record<string, unknown>>;
  setState: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
  dispatchAction: (name: string, params?: Record<string, unknown>) => Promise<void>;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

export function useRuntime(): RuntimeContextValue {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error("Must be rendered inside <OpenSceneProvider>");
  return ctx;
}

export interface RuntimeProviderProps {
  app: OpenSceneSolidApp;
  initialState: Record<string, unknown>;
  children?: JSX.Element;
}

export function RuntimeProvider(props: RuntimeProviderProps): JSX.Element {
  const [state, setRawState] = createSignal<Record<string, unknown>>(
    structuredClone(props.initialState),
  );

  const setState = (updater: (prev: Record<string, unknown>) => Record<string, unknown>) =>
    setRawState(updater);

  const dispatchAction = async (name: string, params?: Record<string, unknown>) => {
    const def: OpenSceneSolidActionDefinition | undefined = props.app.actionDefinitions[name];
    if (!def) return;
    await def.handler(params, setState, state());
  };

  return (
    <RuntimeContext value={{ app: props.app, state, setState, dispatchAction }}>
      {props.children}
    </RuntimeContext>
  );
}
