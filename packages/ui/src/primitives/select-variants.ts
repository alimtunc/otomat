import { cva } from "class-variance-authority";

import { cn } from "../lib/utils";

export const triggerVariants = cva(
  cn(
    "flex w-full items-center justify-between gap-2 bg-background text-foreground",
    "border border-input rounded-md font-sans text-sm",
    "data-[placeholder]:text-text-tertiary",
    "focus:outline-none focus-visible:border-iris-ring focus-visible:shadow-[0_0_0_3px_var(--iris-subtle-bg)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "aria-[invalid=true]:border-danger",
    "[&>span]:truncate",
  ),
  {
    variants: {
      density: {
        compact: "h-8 px-2.5",
        comfortable: "h-9 px-3",
      },
    },
    defaultVariants: { density: "compact" },
  },
);
