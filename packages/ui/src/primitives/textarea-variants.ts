import { cva } from "class-variance-authority";

import { cn } from "../lib/utils";

export const textareaVariants = cva(
  cn(
    "w-full bg-background text-foreground border border-input rounded-md font-sans text-sm",
    "leading-normal resize-y",
    "placeholder:text-text-tertiary",
    "focus:outline-none focus:border-iris-ring focus:shadow-[0_0_0_3px_var(--iris-subtle-bg)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-[0_0_0_3px_var(--danger-bg)]",
  ),
  {
    variants: {
      density: {
        compact: "min-h-16 px-2.5 py-2",
        comfortable: "min-h-20 px-3 py-2.5",
      },
    },
    defaultVariants: { density: "compact" },
  },
);
