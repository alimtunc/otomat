import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";
import { POPUP_MOTION_CLASS, POPUP_MOTION_STYLE } from "./styles";

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
          className={cn(
            "min-w-47.5 rounded-lg border border-border bg-popover p-1.25 shadow-(--shadow-overlay)",
            POPUP_MOTION_CLASS,
            className,
          )}
          style={{ ...POPUP_MOTION_STYLE, ...style }}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPortal>
  );
}
