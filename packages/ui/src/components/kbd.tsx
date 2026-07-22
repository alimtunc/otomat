import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";

export interface KbdProps extends ComponentPropsWithoutRef<"kbd"> {
  keys?: string;
  tone?: "default" | "on-accent";
}

const TONE_CLASS = {
  default: "bg-surface-1 border-border text-text-tertiary",
  "on-accent": "bg-on-accent/15 border-on-accent/40 text-on-accent",
} as const;

export function Kbd({ className, keys, tone = "default", children, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex items-center justify-center min-w-4 h-4.25 px-1",
        "rounded-sm border font-mono text-[10px] leading-none",
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      {keys ?? children}
    </kbd>
  );
}
