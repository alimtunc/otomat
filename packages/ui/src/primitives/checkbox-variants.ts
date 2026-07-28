import { cva } from "class-variance-authority";

import { cn } from "../lib/utils";

export const checkboxVariants = cva(
  cn(
    "inline-grid place-items-center shrink-0 rounded-sm border border-border-strong bg-background",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris-ring",
    "data-[checked]:bg-iris data-[checked]:border-transparent",
    "data-[indeterminate]:bg-iris data-[indeterminate]:border-transparent",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ),
  {
    variants: {
      density: {
        compact: "size-4",
        comfortable: "size-4.5",
      },
    },
    defaultVariants: { density: "compact" },
  },
);
