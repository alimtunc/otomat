import { cva } from "class-variance-authority";

import { cn } from "../lib/utils";

export const badgeVariants = cva(
  cn(
    "inline-flex items-center gap-1 font-sans font-medium tabular-nums",
    "[&>svg]:size-3 [&>svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        default: "h-4.5 px-1.5 rounded-sm bg-surface-2 text-text-secondary text-micro",
        count:
          "min-w-4.25 h-4.25 px-1.25 justify-center rounded-full bg-surface-3 text-text-secondary text-micro",
        iris: "h-4.5 px-1.5 rounded-sm bg-iris-bg text-iris-text text-micro",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
