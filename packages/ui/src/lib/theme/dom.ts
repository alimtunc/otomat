import { ACCENT_VARS, accentVars } from "./accent";
import type { ThemeState } from "./types";

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
