import { DEFAULTS, type ThemeState } from "./types";

const STORAGE_KEY = "otomat.theme";

/**
 * Reads persisted theme state from `localStorage`, coercing each field to a valid
 * value and falling back to `DEFAULTS` for anything missing or malformed. Returns
 * `DEFAULTS` when there is no `window` (SSR) or on any read/parse error.
 */
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

/** Persists theme state to `localStorage`; a no-op with no `window` (SSR) and silent when storage is unavailable. */
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
