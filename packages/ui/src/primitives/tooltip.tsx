import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipPortal = TooltipPrimitive.Portal;

export interface TooltipContentProps extends ComponentPropsWithRef<typeof TooltipPrimitive.Popup> {
  side?: TooltipPrimitive.Positioner.Props["side"];
  sideOffset?: TooltipPrimitive.Positioner.Props["sideOffset"];
}

export function TooltipContent({
  className,
  side,
  sideOffset = 6,
  style,
  ref,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPortal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        style={{ zIndex: "var(--z-tooltip)" }}
      >
        <TooltipPrimitive.Popup
          ref={ref}
          className={cn(
            "whitespace-nowrap rounded-sm border border-border bg-surface-3 px-2 py-1 text-xs text-foreground",
            "opacity-0 data-[open]:opacity-100",
            "origin-(--transform-origin)",
            className,
          )}
          style={{
            transition:
              "opacity var(--motion-fast) var(--ease), transform var(--motion-fast) var(--ease)",
            ...style,
          }}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPortal>
  );
}
