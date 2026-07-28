import { cva } from "class-variance-authority";

import { cn } from "../lib/utils";

export const inputVariants = cva(
  cn(
    "w-full bg-background text-foreground border border-input rounded-md font-sans text-sm",
    "placeholder:text-text-tertiary",
    "focus:outline-none focus:border-iris-ring focus:shadow-[0_0_0_3px_var(--iris-subtle-bg)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-[0_0_0_3px_var(--danger-bg)]",
  ),
  {
    variants: {
      density: {
        compact: "h-8 px-2.5",
        comfortable: "h-9 px-3",
      },
      hasIcon: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      { density: "compact", hasIcon: true, className: "pl-7.5" },
      { density: "comfortable", hasIcon: true, className: "pl-8.5" },
    ],
    defaultVariants: { density: "compact", hasIcon: false },
  },
);
