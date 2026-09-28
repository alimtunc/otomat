import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";

export interface SpinnerProps extends ComponentPropsWithoutRef<"output"> {
  size?: number;
  label?: string;
  motion?: "breathe" | "orbit";
}

export function Spinner({
  className,
  size = 14,
  label,
  motion = "orbit",
  children,
  ...props
}: SpinnerProps) {
  return (
    <output
      aria-label={label ?? (children ? undefined : "Loading")}
      data-slot="spinner"
      className={cn("inline-flex shrink-0 items-center gap-2", className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn("otomat-mark", motion === "breathe" ? "otomat-loader" : "otomat-orbit")}
        style={{ fontSize: size }}
      >
        {motion === "orbit" ? (
          <>
            <span className="otomat-orbit-half">
              <span className="otomat-orbit-ring" />
            </span>
            <span className="otomat-orbit-half">
              <span className="otomat-orbit-ring" />
            </span>
          </>
        ) : null}
      </span>
      {children}
    </output>
  );
}
