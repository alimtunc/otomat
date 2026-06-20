import { DEFAULTS, type ThemeState } from "./types";

const STORAGE_KEY = "otomat.theme";

export function readStored(): ThemeState {
  if (typeof window === "undefined") {
    return DEFAULTS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULTS;
    }
    const parsed = JSON.parse(raw) as Partial<ThemeState>;
    return {
      theme: parsed.theme === "light" ? "light" : "dark",
      density: parsed.density === "comfortable" ? "comfortable" : "compact",
      direction:
        parsed.direction === "brass" || parsed.direction === "viridian" ? parsed.direction : "iris",
      accent: typeof parsed.accent === "string" ? parsed.accent : null,
    };
  } catch {
    return DEFAULTS;
  }
}

export function writeStored(state: ThemeState): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable; in-memory state still applied */
  }
}
