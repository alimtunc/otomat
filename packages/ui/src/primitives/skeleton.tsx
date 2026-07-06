import type { HTMLAttributes } from "react";

import { injectStyleOnce } from "../lib/inject-style";
import { cn } from "../lib/utils";

const SHIMMER_STYLE_ID = "otomat-skeleton-shimmer";
const SHIMMER_CSS = `
@keyframes otomat-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
.otomat-skeleton{background:linear-gradient(90deg,var(--surface-2) 25%,var(--surface-3) 37%,var(--surface-2) 63%);background-size:400% 100%;animation:otomat-shimmer 1.4s ease infinite;border-radius:var(--radius-sm)}
@media (prefers-reduced-motion:reduce){.otomat-skeleton{animation:none}}
`;

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  circle?: boolean;
}

export function Skeleton({
  width,
  height,
  circle = false,
  className,
  style,
  ...props
}: SkeletonProps) {
  injectStyleOnce(SHIMMER_STYLE_ID, SHIMMER_CSS);
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn("otomat-skeleton", circle && "rounded-full", className)}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}
