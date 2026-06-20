import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";

export interface SeparatorProps extends ComponentPropsWithoutRef<typeof SeparatorPrimitive> {}

export function Separator({ className, orientation = "horizontal", ...props }: SeparatorProps) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      style={{ background: "var(--border-subtle)" }}
      className={cn(
        "shrink-0",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}
