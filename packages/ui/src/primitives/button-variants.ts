import { cva } from "class-variance-authority";

import { cn } from "../lib/utils";

export const buttonVariants = cva(
  cn(
    "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-md border font-sans font-medium",
    "disabled:opacity-45 disabled:pointer-events-none",
    "active:translate-y-[0.5px]",
    "[&>svg]:size-3.5 [&>svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        default:
          "bg-surface-2 border-border text-foreground hover:bg-surface-3 hover:border-border-strong",
        primary:
          "border-transparent text-on-accent bg-iris hover:bg-iris-hover active:bg-iris-active shadow-[var(--shadow-button)]",
        light: "border-transparent bg-button-light text-button-light-fg hover:bg-on-accent",
        ghost:
          "border-transparent bg-transparent text-text-secondary hover:bg-hover hover:text-foreground",
        outline:
          "bg-transparent border-border text-foreground hover:bg-surface-3 hover:border-border-strong",
        destructive:
          "bg-transparent border-border text-danger hover:bg-danger-bg hover:border-danger",
      },
      size: {
        default: "h-7.5 px-2.75 text-sm",
        sm: "h-6.5 px-2.25 text-sm",
        xs: "h-5.5 px-1.75 text-xs gap-1 [&>svg]:size-3",
      },
      density: {
        compact: "",
        comfortable: "",
      },
    },
    compoundVariants: [
      { density: "comfortable", size: "default", className: "h-8" },
      { density: "comfortable", size: "sm", className: "h-7" },
      { density: "comfortable", size: "xs", className: "h-6" },
    ],
    defaultVariants: { variant: "default", size: "default", density: "compact" },
  },
);
