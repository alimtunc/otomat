import { createContext, type ReactNode, use, useEffect, useMemo, useReducer } from "react";

import { applyTheme } from "./dom";
import { themeReducer } from "./reducer";
import { readStored, writeStored } from "./storage";
import type { Accent, Density, Theme, ThemeContextValue } from "./types";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Seeds theme state from `localStorage` (falling back to `DEFAULTS` on the server
 * or first visit) and, on every change, mirrors it to `document.documentElement`
 * via `applyTheme` and persists it via `writeStored`. Wrap the app once; consume
 * with `useTheme`.
 */
export function ThemeProvider({ children }: ThemeProviderProps): ReactNode {
  const [state, dispatch] = useReducer(themeReducer, null, readStored);

  // otomat-allow-effect: mirror the resolved theme to the document root and persist it.
  useEffect(() => {
    applyTheme(document.documentElement, state);
    writeStored(state);
  }, [state]);

  const actions = useMemo(
    () => ({
      setTheme: (theme: Theme) => dispatch({ type: "setTheme", theme }),
      toggleTheme: () => dispatch({ type: "toggleTheme" }),
      setDensity: (density: Density) => dispatch({ type: "setDensity", density }),
      setAccent: (accent: Accent) => dispatch({ type: "setAccent", accent }),
      setCustomAccent: (hex: string | null) =>
        dispatch({ type: "setCustomAccent", customAccent: hex }),
    }),
    [],
  );

  const value = useMemo<ThemeContextValue>(() => ({ ...state, ...actions }), [state, actions]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Reads theme state plus its setters from context. Throws when called outside a `ThemeProvider`. */
export function useTheme(): ThemeContextValue {
  const ctx = use(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
