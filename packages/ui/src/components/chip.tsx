import type { HTMLAttributes, ReactNode } from "react";

import { toneClassMap, type StatusTone } from "../lib/status";
import { cn } from "../lib/utils";

export type ChipSize = "sm" | "lg";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  size?: ChipSize;
  children: ReactNode;
}

const TONE_CLASS: Record<StatusTone, string> = toneClassMap(
  (facets) => `${facets.subtleBg} ${facets.textOnSubtle}`,
);

export function Chip({
  tone = "neutral",
  size = "sm",
  className,
  children,
  role = "status",
  ...rest
}: ChipProps) {
  return (
    <span
      role={role}
      className={cn(
        "inline-flex items-center gap-1.25 whitespace-nowrap rounded-sm border border-transparent px-1.75 font-medium [&_svg]:size-3",
        size === "lg" ? "h-5.5 text-sm" : "h-5 text-xs",
        TONE_CLASS[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
