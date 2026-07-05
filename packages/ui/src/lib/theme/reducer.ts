import type { Density, Direction, Theme, ThemeState } from "./types";

export type ThemeAction =
  | { type: "setTheme"; theme: Theme }
  | { type: "toggleTheme" }
  | { type: "setDensity"; density: Density }
  | { type: "setDirection"; direction: Direction }
  | { type: "setAccent"; accent: string | null };

/**
 * Pure theme-state transitions. `setDirection` also clears any custom `accent`
 * (the incoming palette supplies its own), so switching direction resets `accent` to null.
 */
export function themeReducer(state: ThemeState, action: ThemeAction): ThemeState {
  switch (action.type) {
    case "setTheme":
      return { ...state, theme: action.theme };
    case "toggleTheme":
      return { ...state, theme: state.theme === "dark" ? "light" : "dark" };
    case "setDensity":
      return { ...state, density: action.density };
    case "setDirection":
      return { ...state, direction: action.direction, accent: null };
    case "setAccent":
      return { ...state, accent: action.accent };
  }
}
