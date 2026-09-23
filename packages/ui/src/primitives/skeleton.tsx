import { createContext, useContext, type HTMLAttributes } from "react";

import { injectStyleOnce } from "../lib/inject-style";
import { cn } from "../lib/utils";

const SHIMMER_STYLE_ID = "otomat-skeleton-shimmer";
// The reveal delay keeps a fast read from flashing a placeholder at all.
const SHIMMER_CSS = `
@keyframes otomat-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
@keyframes otomat-skeleton-in{from{opacity:0}to{opacity:1}}
.otomat-skeleton{background:linear-gradient(90deg,var(--surface-2) 25%,var(--surface-3) 37%,var(--surface-2) 63%);background-size:400% 100%;animation:otomat-skeleton-in var(--motion-medium) ease-out 180ms backwards,otomat-shimmer 1.6s ease 180ms infinite;border-radius:var(--radius-sm)}
.otomat-skeleton-group{animation:otomat-skeleton-in var(--motion-medium) ease-out 180ms backwards}
.otomat-skeleton-group .otomat-skeleton{animation:otomat-shimmer 1.6s ease 180ms infinite}
@media (prefers-reduced-motion:reduce){.otomat-skeleton,.otomat-skeleton-group{animation:otomat-skeleton-in 0s 180ms backwards}.otomat-skeleton-group .otomat-skeleton{animation:none}}
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

const InsideSkeletonGroup = createContext(false);

/** A placeholder's frame — its borders and header rows — waits out the reveal delay with its blocks; only the outermost announces it. */
export function SkeletonGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const nested = useContext(InsideSkeletonGroup);
  injectStyleOnce(SHIMMER_STYLE_ID, SHIMMER_CSS);
  if (nested) return <div className={className} {...props} />;
  return (
    <InsideSkeletonGroup.Provider value={true}>
      <div
        role="status"
        aria-label="Loading"
        className={cn("otomat-skeleton-group", className)}
        {...props}
      />
    </InsideSkeletonGroup.Provider>
  );
}
