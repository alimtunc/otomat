import { Toggle } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "../lib/utils";
import { ToggleGroupRoot, type ToggleGroupRootProps } from "../primitives/toggle-group";

const segmentedVariants = cva(
  "inline-flex gap-0.5 bg-surface-2 border border-border rounded-md p-0.5",
);

const segmentedItemVariants = cva(
  [
    "inline-flex items-center gap-1.25 px-2.25 font-medium rounded-[4px]",
    "text-text-secondary outline-none",
    "transition-[background,color] duration-[--motion-fast] ease-standard",
    "hover:text-foreground",
    "data-[pressed]:bg-surface-3 data-[pressed]:text-foreground data-[pressed]:shadow-[--shadow-sm]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:size-3.25 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      density: {
        compact: "h-6 text-xs",
        comfortable: "h-7 text-sm",
      },
    },
    defaultVariants: {
      density: "compact",
    },
  },
);

export type SegmentedControlProps = ToggleGroupRootProps;

export function SegmentedControl({ className, ...props }: SegmentedControlProps) {
  return <ToggleGroupRoot className={cn(segmentedVariants(), className)} {...props} />;
}

export interface SegmentedItemProps
  extends ComponentPropsWithoutRef<typeof Toggle>, VariantProps<typeof segmentedItemVariants> {
  icon?: ReactNode;
}

export function SegmentedItem({
  className,
  density,
  icon,
  children,
  ...props
}: SegmentedItemProps) {
  return (
    <Toggle className={cn(segmentedItemVariants({ density }), className)} {...props}>
      {icon}
      {children}
    </Toggle>
  );
}
