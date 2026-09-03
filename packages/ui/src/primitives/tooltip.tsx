import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";
import { POPUP_MOTION_CLASS, POPUP_MOTION_STYLE } from "./styles";

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
            POPUP_MOTION_CLASS,
            className,
          )}
          style={{ ...POPUP_MOTION_STYLE, ...style }}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPortal>
  );
}
