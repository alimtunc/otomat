import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";

export interface WordmarkProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  enter?: boolean;
}

export function Wordmark({ className, enter = false, ...props }: WordmarkProps) {
  return (
    <span
      role="img"
      aria-label="Otomat"
      data-enter={enter || undefined}
      className={cn("otomat-wordmark", className)}
      {...props}
    >
      <span className="otomat-mark" aria-hidden="true" />
      <span className="otomat-letter" aria-hidden="true">
        t
      </span>
      <span className="otomat-mark" aria-hidden="true" />
      <span className="otomat-letter" aria-hidden="true">
        mat
      </span>
    </span>
  );
}
