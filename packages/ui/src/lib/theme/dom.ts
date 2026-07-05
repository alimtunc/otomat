import { ACCENT_VARS, accentVars } from "./accent";
import type { ThemeState } from "./types";

/**
 * Mutates `root` in place: toggles the `dark`/`light` classes, sets `data-dir`/`data-density`,
 * and writes the accent CSS custom properties. When `accent` is null it removes every accent
 * var so the stylesheet's default palette takes over.
 */
export function applyTheme(root: HTMLElement, state: ThemeState): void {
  root.classList.toggle("dark", state.theme === "dark");
  root.classList.toggle("light", state.theme === "light");
  root.dataset.dir = state.direction;
  root.dataset.density = state.density;

  if (!state.accent) {
    for (const name of ACCENT_VARS) {
      root.style.removeProperty(name);
    }
    return;
  }

  const vars = accentVars(state.accent);
  for (const name of ACCENT_VARS) {
    root.style.setProperty(name, vars[name]);
  }
}
