export type Theme = "dark" | "light";
export type Density = "compact" | "comfortable";
/** Named accent palette (surfaced as `data-dir` on the root), not text direction. */
export type Direction = "iris" | "brass" | "viridian";

export interface ThemeState {
  theme: Theme;
  density: Density;
  direction: Direction;
  /** Custom accent hex override, or null to use the palette's default accent. */
  accent: string | null;
}

export interface ThemeContextValue extends ThemeState {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setDensity: (density: Density) => void;
  setDirection: (direction: Direction) => void;
  setAccent: (hex: string | null) => void;
}

export const DEFAULTS: ThemeState = {
  theme: "dark",
  density: "compact",
  direction: "iris",
  accent: null,
};
