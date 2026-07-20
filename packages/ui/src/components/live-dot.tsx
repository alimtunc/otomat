import type { ComponentPropsWithoutRef } from "react";

import { injectStyleOnce } from "../lib/inject-style";
import { toneClassMap, type StatusTone } from "../lib/status";
import { cn } from "../lib/utils";

const LIVEDOT_STYLE_ID = "otomat-livedot";
const LIVEDOT_CSS = `
@keyframes otomat-livedot-breathe{0%,100%{opacity:1}50%{opacity:.4}}
.otomat-livedot{animation:otomat-livedot-breathe 2.4s var(--ease) infinite}
@media (prefers-reduced-motion:reduce){.otomat-livedot{animation:none}}
`;

const TONE_CLASS: Record<StatusTone, string> = toneClassMap((facets) => facets.solid);

export interface LiveDotProps extends ComponentPropsWithoutRef<"span"> {
  tone?: StatusTone;
  live?: boolean;
  size?: number;
}

export function LiveDot({
  className,
  tone = "neutral",
  live = false,
  size = 7,
  style,
  ...props
}: LiveDotProps) {
  if (live) injectStyleOnce(LIVEDOT_STYLE_ID, LIVEDOT_CSS);
  return (
    <span
      aria-hidden="true"
      data-slot="live-dot"
      data-live={live || undefined}
      className={cn(
        "inline-block shrink-0 rounded-full",
        TONE_CLASS[tone],
        live && "otomat-livedot",
        className,
      )}
      style={{ width: size, height: size, ...style }}
      {...props}
    />
  );
}
