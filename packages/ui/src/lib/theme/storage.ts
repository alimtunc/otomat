import { DEFAULTS, type ThemeState } from "./types";

const STORAGE_KEY = "otomat.theme";

// The persisted JSON keeps the legacy `direction`/`accent` field names so stored themes survive the rename.
interface StoredThemeState {
  theme?: unknown;
  density?: unknown;
  direction?: unknown;
  accent?: unknown;
}

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
    const parsed = JSON.parse(raw) as StoredThemeState;
    return {
      theme: parsed.theme === "light" ? "light" : "dark",
      density: parsed.density === "comfortable" ? "comfortable" : "compact",
      accent:
        parsed.direction === "brass" || parsed.direction === "viridian" ? parsed.direction : "iris",
      customAccent: typeof parsed.accent === "string" ? parsed.accent : null,
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
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        theme: state.theme,
        density: state.density,
        direction: state.accent,
        accent: state.customAccent,
      }),
    );
  } catch {
    /* storage unavailable; in-memory state still applied */
  }
}
