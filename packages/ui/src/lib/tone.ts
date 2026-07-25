export type StatusTone =
  | "neutral"
  | "iris"
  | "success"
  | "warning"
  | "danger"
  | "review"
  | "stale"
  | "ghost";

export interface ToneFacets {
  text: string;
  textOnSubtle: string;
  subtleBg: string;
  solid: string;
  cssVar: string;
  subtleBgVar?: string;
}

export const TONE_FACETS: Record<StatusTone, ToneFacets> = {
  neutral: {
    text: "text-text-tertiary",
    textOnSubtle: "text-text-secondary",
    subtleBg: "bg-neutral-bg",
    solid: "bg-neutral",
    cssVar: "var(--neutral)",
  },
  iris: {
    text: "text-iris-text",
    textOnSubtle: "text-iris-text",
    subtleBg: "bg-iris-bg",
    solid: "bg-iris",
    cssVar: "var(--iris-solid)",
  },
  success: {
    text: "text-success",
    textOnSubtle: "text-success",
    subtleBg: "bg-success-bg",
    solid: "bg-success",
    cssVar: "var(--success)",
  },
  warning: {
    text: "text-warning",
    textOnSubtle: "text-warning",
    subtleBg: "bg-warning-bg",
    solid: "bg-warning",
    cssVar: "var(--warning)",
    subtleBgVar: "var(--warning-bg)",
  },
  danger: {
    text: "text-danger",
    textOnSubtle: "text-danger",
    subtleBg: "bg-danger-bg",
    solid: "bg-danger",
    cssVar: "var(--danger)",
    subtleBgVar: "var(--danger-bg)",
  },
  review: {
    text: "text-review",
    textOnSubtle: "text-review",
    subtleBg: "bg-review-bg",
    solid: "bg-review",
    cssVar: "var(--review)",
  },
  stale: {
    text: "text-stale",
    textOnSubtle: "text-stale",
    subtleBg: "bg-stale-bg",
    solid: "bg-stale",
    cssVar: "var(--stale)",
  },
  ghost: {
    text: "text-text-tertiary",
    textOnSubtle: "text-text-secondary",
    subtleBg: "bg-transparent border-border",
    solid: "bg-text-tertiary",
    cssVar: "var(--text-tertiary)",
  },
};

const TONE_ENTRIES = Object.entries(TONE_FACETS) as [StatusTone, ToneFacets][];

export function toneClassMap(pick: (facets: ToneFacets) => string): Record<StatusTone, string> {
  return Object.fromEntries(TONE_ENTRIES.map(([tone, facets]) => [tone, pick(facets)])) as Record<
    StatusTone,
    string
  >;
}

export const TONE_TEXT: Record<StatusTone, string> = toneClassMap((facets) => facets.text);

export const TONE_BG: Partial<Record<StatusTone, string>> = Object.fromEntries(
  TONE_ENTRIES.flatMap(([tone, facets]) =>
    facets.subtleBgVar ? [[tone, facets.subtleBgVar]] : [],
  ),
);
