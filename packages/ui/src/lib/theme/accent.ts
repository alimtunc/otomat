function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex(channels: number[]): string {
  return `#${channels.map((v) => `0${clamp(v).toString(16)}`.slice(-2)).join("")}`;
}

function lighten(hex: string, amount: number): string {
  return toHex(toRgb(hex).map((v) => v + (255 - v) * amount));
}

function darken(hex: string, amount: number): string {
  return toHex(toRgb(hex).map((v) => v * (1 - amount)));
}

export const ACCENT_VARS = [
  "--iris-solid",
  "--iris-hover",
  "--iris-active",
  "--iris-ring",
  "--iris-text",
  "--iris-subtle-bg",
  "--iris-bg",
  "--selected",
  "--info",
  "--primary",
  "--ring",
] as const;

export type AccentVar = (typeof ACCENT_VARS)[number];

export function accentVars(hex: string): Record<AccentVar, string> {
  const channels = toRgb(hex).join(",");
  return {
    "--iris-solid": hex,
    "--iris-hover": lighten(hex, 0.14),
    "--iris-active": darken(hex, 0.12),
    "--iris-ring": hex,
    "--iris-text": lighten(hex, 0.35),
    "--iris-subtle-bg": `rgba(${channels},.13)`,
    "--iris-bg": `rgba(${channels},.13)`,
    "--selected": `rgba(${channels},.12)`,
    "--info": hex,
    "--primary": hex,
    "--ring": hex,
  };
}
