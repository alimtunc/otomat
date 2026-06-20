import type { HTMLAttributes, ReactNode } from "react";

import type { StatusTone } from "../lib/status";
import { cn } from "../lib/utils";

export type ChipSize = "sm" | "lg";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  size?: ChipSize;
  children: ReactNode;
}

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-neutral-bg text-text-secondary",
  iris: "bg-iris-bg text-iris-text",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  review: "bg-review-bg text-review",
  stale: "bg-stale-bg text-stale",
  ghost: "bg-transparent border-border text-text-secondary",
};

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
