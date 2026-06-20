import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";

export interface KbdProps extends ComponentPropsWithoutRef<"kbd"> {
  keys?: string;
}

export function Kbd({ className, keys, children, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex items-center justify-center min-w-4 h-4.25 px-1",
        "font-mono text-[10px] leading-none text-text-tertiary",
        "bg-surface-1 border border-border rounded-sm",
        className,
      )}
      {...props}
    >
      {keys ?? children}
    </kbd>
  );
}
