import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";

export interface AutoTextareaProps extends Omit<ComponentPropsWithoutRef<"textarea">, "value"> {
  value: string;
}

/**
 * Grows with its content, with no measuring pass: the value is mirrored into a
 * sibling that shares the same grid cell, so the cell's own height is the
 * textarea's height. The trailing space keeps a value ending in a newline one
 * line tall. Where it stops growing belongs to the container, which scrolls.
 */
export function AutoTextarea({ className, value, ...props }: AutoTextareaProps) {
  return (
    <div className="grid w-full">
      <textarea
        value={value}
        rows={1}
        className={cn(
          "col-start-1 row-start-1 w-full resize-none overflow-hidden bg-transparent",
          "font-sans text-sm leading-normal text-foreground outline-none placeholder:text-text-tertiary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          "invisible col-start-1 row-start-1 w-full whitespace-pre-wrap break-words",
          "font-sans text-sm leading-normal",
          className,
        )}
      >
        {`${value} `}
      </span>
    </div>
  );
}
