import type { EventSource } from "@otomat/domain";

export interface SurfaceSwatch {
  varName: string;
  hex: string;
}

export const SURFACE_SWATCHES: SurfaceSwatch[] = [
  { varName: "--background", hex: "#0A0B0D" },
  { varName: "--sidebar", hex: "#0C0D10" },
  { varName: "--surface-1", hex: "#101216" },
  { varName: "--surface-2", hex: "#16181D" },
  { varName: "--surface-3", hex: "#1B1E25" },
  { varName: "--iris-solid", hex: "#5B7CFA" },
  { varName: "--success", hex: "#3FB950" },
  { varName: "--warning", hex: "#D8A12B" },
  { varName: "--danger", hex: "#F2545B" },
  { varName: "--review", hex: "#A371F7" },
  { varName: "--stale", hex: "#E0833B" },
];

export const PROVENANCE_SOURCES: EventSource[] = [
  "otomat",
  "claude",
  "codex",
  "git",
  "github",
  "linear",
  "system",
];

export interface AccentSwatch {
  hex: string;
  label: string;
}

export const ACCENT_SWATCHES: AccentSwatch[] = [
  { hex: "#5B7CFA", label: "Iris" },
  { hex: "#C08B3E", label: "Brass" },
  { hex: "#4FAE8B", label: "Viridian" },
  { hex: "#E0457B", label: "Rose" },
  { hex: "#A371F7", label: "Violet" },
];

export interface CardRunFixture {
  id: string;
  branch: string;
  added: number;
  removed: number;
}

export const CARD_RUN: CardRunFixture = {
  id: "r3",
  branch: "otomat/7-csv",
  added: 124,
  removed: 6,
};
