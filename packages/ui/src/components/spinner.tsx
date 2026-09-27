import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";

export interface SpinnerProps extends ComponentPropsWithoutRef<"output"> {
  size?: number;
  label?: string;
  motion?: "breathe" | "pulse";
}

export function Spinner({
  className,
  size = 14,
  label,
  motion = "pulse",
  children,
  ...props
}: SpinnerProps) {
  return (
    <output
      aria-label={label ?? (children === undefined ? "Loading" : undefined)}
      data-slot="spinner"
      className={cn("inline-flex shrink-0 items-center gap-2", className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn("otomat-mark", motion === "breathe" ? "otomat-loader" : "otomat-pulse")}
        style={{ fontSize: size }}
      />
      {children}
    </output>
  );
}
