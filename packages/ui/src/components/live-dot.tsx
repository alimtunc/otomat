import type { ComponentPropsWithoutRef } from "react";

import type { StatusTone } from "../lib/status";
import { cn } from "../lib/utils";

const LIVEDOT_STYLE_ID = "otomat-livedot";
const LIVEDOT_CSS = `
@keyframes otomat-livedot-pulse{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:0;transform:scale(2.6)}}
.otomat-livedot{position:relative}
.otomat-livedot::after{content:"";position:absolute;inset:0;border-radius:inherit;background:inherit;animation:otomat-livedot-pulse 1.6s var(--ease) infinite}
@media (prefers-reduced-motion:reduce){.otomat-livedot::after{display:none}}
`;

function ensureLiveDotStyle(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(LIVEDOT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = LIVEDOT_STYLE_ID;
  style.textContent = LIVEDOT_CSS;
  document.head.appendChild(style);
}

const TONE_CLASS: Record<Exclude<StatusTone, "ghost">, string> = {
  neutral: "bg-neutral",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  review: "bg-review",
  stale: "bg-stale",
  iris: "bg-iris",
};

export interface LiveDotProps extends ComponentPropsWithoutRef<"span"> {
  tone?: keyof typeof TONE_CLASS;
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
  if (live) ensureLiveDotStyle();
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
