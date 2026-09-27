import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";
import { POPUP_MOTION_CLASS, POPUP_MOTION_STYLE, POPUP_SURFACE_CLASS } from "./styles";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverPortal = PopoverPrimitive.Portal;

export interface PopoverContentProps extends ComponentPropsWithRef<typeof PopoverPrimitive.Popup> {
  align?: PopoverPrimitive.Positioner.Props["align"];
  side?: PopoverPrimitive.Positioner.Props["side"];
  sideOffset?: PopoverPrimitive.Positioner.Props["sideOffset"];
}

export function PopoverContent({
  className,
  align = "center",
  side,
  sideOffset = 6,
  style,
  ref,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPortal>
      <PopoverPrimitive.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        style={{ zIndex: "var(--z-popover)" }}
      >
        <PopoverPrimitive.Popup
          ref={ref}
          className={cn(POPUP_SURFACE_CLASS, "min-w-47.5 p-1.25", POPUP_MOTION_CLASS, className)}
          style={{ ...POPUP_MOTION_STYLE, ...style }}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPortal>
  );
}
