import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";

import { createInitialAppState, type AppState } from "./app-state";

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: PropsWithChildren): JSX.Element {
  const [state] = useState<AppState>(createInitialAppState());
  const value = useMemo(() => state, [state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const state = useContext(AppStateContext);
  if (!state) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return state;
}
