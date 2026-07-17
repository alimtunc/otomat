export type Theme = "dark" | "light";
export type Density = "compact" | "comfortable";
/** Named accent palette (surfaced as `data-dir` on the root), not text direction. */
export type Accent = "iris" | "brass" | "viridian";

export interface ThemeState {
  theme: Theme;
  density: Density;
  accent: Accent;
  /** Custom accent hex override, or null to use the palette's default accent. */
  customAccent: string | null;
}

export interface ThemeContextValue extends ThemeState {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setDensity: (density: Density) => void;
  setAccent: (accent: Accent) => void;
  setCustomAccent: (hex: string | null) => void;
}

export const DEFAULTS: ThemeState = {
  theme: "dark",
  density: "compact",
  accent: "iris",
  customAccent: null,
};
