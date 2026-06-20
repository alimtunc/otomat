export type Theme = "dark" | "light";
export type Density = "compact" | "comfortable";
export type Direction = "iris" | "brass" | "viridian";

export interface ThemeState {
  theme: Theme;
  density: Density;
  direction: Direction;
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
