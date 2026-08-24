import {
  createContext,
  createEffect,
  createSignal,
  useContext,
  type Accessor,
  type JSX,
} from "solid-js";
import { setValueByPointer } from "./evaluate.js";
import type { ActionHandler, ComponentRegistry, StateUpdater } from "./types.js";

export interface RuntimeContextValue {
  state: Accessor<Record<string, unknown>>;
  setState: (updater: StateUpdater) => void;
  setStateByPath: (pointer: string, value: unknown) => void;
  dispatchAction: (name: string, params?: Record<string, unknown>) => Promise<unknown>;
  registry: ComponentRegistry;
}
const RuntimeContext = createContext<RuntimeContextValue>();
export interface RuntimeProviderProps {
  initialState?: Record<string, unknown>;
  registry: ComponentRegistry;
  actions?: Record<string, ActionHandler>;
  onStateChange?: (changes: { path: string; value: unknown }[]) => void;
  children?: JSX.Element;
}

export function RuntimeProvider(props: RuntimeProviderProps): JSX.Element {
  const [state, setRawState] = createSignal<Record<string, unknown>>(
    props.initialState ? structuredClone(props.initialState) : {},
  );

  createEffect(() => {
    if (props.initialState) {
      setRawState(structuredClone(props.initialState));
    }
  });

  const setState: RuntimeContextValue["setState"] = (updater) =>
    setRawState((previous) => (typeof updater === "function" ? updater(previous) : updater));
  const setStateByPath = (pointer: string, value: unknown) => {
    setRawState((previous) => setValueByPointer(previous, pointer, value));
    props.onStateChange?.([{ path: pointer, value }]);
  };
  const builtInActions: Record<string, ActionHandler> = {
    setState: (params, { setState: applyState }) =>
      applyState((previous) => ({ ...previous, ...params })),
  };
  const actions = { ...builtInActions, ...props.actions };
  const dispatchAction: RuntimeContextValue["dispatchAction"] = async (name, params = {}) => {
    const action = actions[name];
    if (!action) return undefined;
    return action(params, { getState: state, setState: (updater) => setState(updater) });
  };
  return (
    <RuntimeContext.Provider
      value={{ state, setState, setStateByPath, dispatchAction, registry: props.registry }}
    >
      {props.children}
    </RuntimeContext.Provider>
  );
}

export function useRuntime(): RuntimeContextValue {
  const context = useContext(RuntimeContext);
  if (!context) throw new Error("OpenScene components must be rendered inside a JsonRenderer.");
  return context;
}
