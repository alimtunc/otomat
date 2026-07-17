import type { ComponentPropsWithoutRef } from "react";

import { injectStyleOnce } from "../lib/inject-style";
import type { StatusTone } from "../lib/status";
import { cn } from "../lib/utils";

const LIVEDOT_STYLE_ID = "otomat-livedot";
const LIVEDOT_CSS = `
@keyframes otomat-livedot-pulse{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:0;transform:scale(2.6)}}
.otomat-livedot{position:relative}
.otomat-livedot::after{content:"";position:absolute;inset:0;border-radius:inherit;background:inherit;animation:otomat-livedot-pulse 1.6s var(--ease) infinite}
@media (prefers-reduced-motion:reduce){.otomat-livedot::after{display:none}}
`;

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-neutral",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  review: "bg-review",
  stale: "bg-stale",
  iris: "bg-iris",
  ghost: "bg-text-tertiary",
};

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
