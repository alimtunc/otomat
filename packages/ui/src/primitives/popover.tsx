import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverPortal = PopoverPrimitive.Portal;
export const PopoverClose = PopoverPrimitive.Close;

export interface PopoverAnchorProps extends ComponentPropsWithRef<"div"> {}

export function PopoverAnchor({ className, ref, ...props }: PopoverAnchorProps) {
  return <div ref={ref} className={className} {...props} />;
}

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
            "opacity-0 data-[open]:opacity-100",
            "transform-[scale(.97)] data-[open]:transform-none",
            "motion-reduce:transform-none",
            "origin-(--transform-origin)",
            className,
          )}
          style={{
            transition:
              "opacity var(--motion-fast) var(--ease), transform var(--motion-fast) var(--ease-spring)",
            ...style,
          }}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPortal>
  );
}
