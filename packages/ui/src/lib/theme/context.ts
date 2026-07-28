import { createContext, use } from "react";

import type { ThemeContextValue } from "./types";

export const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Reads theme state plus its setters from context. Throws when called outside a `ThemeProvider`. */
export function useTheme(): ThemeContextValue {
  const ctx = use(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
