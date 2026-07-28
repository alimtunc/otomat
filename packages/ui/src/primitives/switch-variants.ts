import { cva } from "class-variance-authority";

import { cn } from "../lib/utils";

export const switchVariants = cva(
  cn(
    "relative inline-flex shrink-0 items-center rounded-full border border-border bg-surface-3",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    "data-[checked]:bg-iris data-[checked]:border-transparent",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ),
  {
    variants: {
      density: {
        compact: "h-5 w-8.5",
        comfortable: "h-6 w-10.5",
      },
    },
    defaultVariants: { density: "compact" },
  },
);

export const thumbVariants = cva(
  cn("pointer-events-none block rounded-full bg-text-secondary", "data-[checked]:bg-on-accent"),
  {
    variants: {
      density: {
        compact: "size-3.5 translate-x-0.5 data-[checked]:translate-x-4.5",
        comfortable: "size-4.5 translate-x-0.5 data-[checked]:translate-x-5.5",
      },
    },
    defaultVariants: { density: "compact" },
  },
);
