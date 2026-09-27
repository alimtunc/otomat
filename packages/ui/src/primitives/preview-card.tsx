import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";
import { POPUP_MOTION_CLASS, POPUP_MOTION_STYLE, POPUP_SURFACE_CLASS } from "./styles";

export const PreviewCard = PreviewCardPrimitive.Root;
export const PreviewCardTrigger = PreviewCardPrimitive.Trigger;

export interface PreviewCardContentProps extends ComponentPropsWithRef<
  typeof PreviewCardPrimitive.Popup
> {
  align?: PreviewCardPrimitive.Positioner.Props["align"];
}

export function PreviewCardContent({
  className,
  align = "start",
  style,
  ref,
  ...props
}: PreviewCardContentProps) {
  return (
    <PreviewCardPrimitive.Portal>
      <PreviewCardPrimitive.Positioner
        align={align}
        sideOffset={6}
        style={{ zIndex: "var(--z-popover)" }}
      >
        <PreviewCardPrimitive.Popup
          ref={ref}
          className={cn(
            POPUP_SURFACE_CLASS,
            "max-h-[min(36rem,80dvh)] w-96 max-w-[calc(100vw-1rem)] overflow-y-auto p-3",
            POPUP_MOTION_CLASS,
            className,
          )}
          style={{ ...POPUP_MOTION_STYLE, ...style }}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  );
}
