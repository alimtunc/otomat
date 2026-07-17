import type { Accent, Density, Theme, ThemeState } from "./types";

export type ThemeAction =
  | { type: "setTheme"; theme: Theme }
  | { type: "toggleTheme" }
  | { type: "setDensity"; density: Density }
  | { type: "setAccent"; accent: Accent }
  | { type: "setCustomAccent"; customAccent: string | null };

/**
 * Pure theme-state transitions. `setAccent` also clears any `customAccent`
 * (the incoming palette supplies its own), so switching palette resets `customAccent` to null.
 */
export function themeReducer(state: ThemeState, action: ThemeAction): ThemeState {
  switch (action.type) {
    case "setTheme":
      return { ...state, theme: action.theme };
    case "toggleTheme":
      return { ...state, theme: state.theme === "dark" ? "light" : "dark" };
    case "setDensity":
      return { ...state, density: action.density };
    case "setAccent":
      return { ...state, accent: action.accent, customAccent: null };
    case "setCustomAccent":
      return { ...state, customAccent: action.customAccent };
  }
}
