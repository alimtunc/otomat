import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";

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
            "min-w-47.5 rounded-lg border border-border bg-popover p-1.25 shadow-(--shadow-overlay)",
            className,
          )}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  );
}
