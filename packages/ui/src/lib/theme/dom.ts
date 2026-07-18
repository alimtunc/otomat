import { ACCENT_VARS, accentVars } from "./accent";
import type { ThemeState } from "./types";

/**
 * Mutates `root` in place: toggles the `dark`/`light` classes, sets `data-dir`/`data-density`,
 * and writes the accent CSS custom properties. When `customAccent` is null it removes every
 * accent var so the stylesheet's default palette takes over.
 */
export function applyTheme(root: HTMLElement, state: ThemeState): void {
  root.classList.toggle("dark", state.theme === "dark");
  root.classList.toggle("light", state.theme === "light");
  // The attribute stays `data-dir` (pre-rename name); the stylesheet's palette selectors key off it.
  root.dataset.dir = state.accent;
  root.dataset.density = state.density;

  if (!state.customAccent) {
    for (const name of ACCENT_VARS) {
      root.style.removeProperty(name);
    }
    return;
  }

  const vars = accentVars(state.customAccent);
  for (const name of ACCENT_VARS) {
    root.style.setProperty(name, vars[name]);
  }
}
