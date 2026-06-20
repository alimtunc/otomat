import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";

export type CollapsibleProps = ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Root>;

export function Collapsible(props: CollapsibleProps) {
  return <CollapsiblePrimitive.Root {...props} />;
}

export type CollapsibleTriggerProps = ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger>;

export function CollapsibleTrigger({ className, ...props }: CollapsibleTriggerProps) {
  return (
    <CollapsiblePrimitive.Trigger
      className={cn(
        "inline-flex items-center gap-1.5 outline-none [&_svg]:size-3.5 [&_svg]:shrink-0",
        "[&[data-open]>svg.chevron]:rotate-90",
        "[&>svg.chevron]:transition-transform [&>svg.chevron]:duration-[--motion-fast] [&>svg.chevron]:ease-standard",
        className,
      )}
      {...props}
    />
  );
}

export type CollapsibleContentProps = ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Panel>;

export function CollapsibleContent({ className, ...props }: CollapsibleContentProps) {
  return <CollapsiblePrimitive.Panel className={cn("overflow-hidden", className)} {...props} />;
}
