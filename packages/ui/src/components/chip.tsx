import type { HTMLAttributes, ReactNode } from "react";

import { FOCUS_RING } from "../lib/focus";
import { toneClassMap, type StatusTone } from "../lib/tone";
import { cn } from "../lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";

export type ChipSize = "sm" | "lg";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  size?: ChipSize;
  hint?: string;
  children: ReactNode;
}

const TONE_CLASS: Record<StatusTone, string> = toneClassMap(
  (facets) => `${facets.subtleBg} ${facets.textOnSubtle}`,
);

export function Chip({
  tone = "neutral",
  size = "sm",
  hint,
  className,
  children,
  role = "status",
  ...rest
}: ChipProps) {
  const chip = (
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
  if (hint === undefined) return chip;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          // A tooltip names nothing, so the hint is repeated on the accessible name.
          <span
            tabIndex={0}
            aria-label={typeof children === "string" ? `${children} — ${hint}` : hint}
            className={`rounded-sm ${FOCUS_RING}`}
          />
        }
      >
        {chip}
      </TooltipTrigger>
      <TooltipContent className="max-w-64 whitespace-normal">{hint}</TooltipContent>
    </Tooltip>
  );
}
