import { Toggle } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { toggleStripItemVariants } from "../lib/toggle-strip";
import { cn } from "../lib/utils";
import { ToggleGroupRoot, type ToggleGroupRootProps } from "../primitives/toggle-group";

const segmentedVariants = cva(
  "inline-flex gap-0.5 bg-surface-2 border border-border rounded-md p-0.5",
);

const segmentedItemVariants = toggleStripItemVariants({
  layout: "inline-flex items-center gap-1.25 px-2.25 font-medium rounded-[4px]",
  pressed:
    "data-[pressed]:bg-surface-3 data-[pressed]:text-foreground data-[pressed]:shadow-[--shadow-sm]",
  svg: "[&_svg]:size-3.25 [&_svg]:shrink-0",
});

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
