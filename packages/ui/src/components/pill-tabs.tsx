import { Toggle } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { toggleStripItemVariants } from "../lib/toggle-strip";
import { cn } from "../lib/utils";
import { ToggleGroupRoot, type ToggleGroupRootProps } from "../primitives/toggle-group";

const pillsVariants = cva(
  "inline-flex gap-0.5 bg-surface-1 p-0.75 rounded-md border border-border-subtle",
);

const pillVariants = toggleStripItemVariants({
  layout: "inline-flex items-center gap-1.5 px-2.5 font-medium rounded-[4px]",
  pressed: "data-[pressed]:bg-surface-3 data-[pressed]:text-foreground",
  svg: "[&_svg]:size-3.5 [&_svg]:shrink-0",
  extra: "[&_[data-pill-badge]]:bg-transparent",
});

export type PillTabsProps = ToggleGroupRootProps;

export function PillTabs({ className, ...props }: PillTabsProps) {
  return <ToggleGroupRoot className={cn(pillsVariants(), className)} {...props} />;
}

export interface PillProps
  extends ComponentPropsWithoutRef<typeof Toggle>, VariantProps<typeof pillVariants> {
  icon?: ReactNode;
  badge?: ReactNode;
}

export function Pill({ className, density, icon, badge, children, ...props }: PillProps) {
  return (
    <Toggle className={cn(pillVariants({ density }), className)} {...props}>
      {icon}
      {children}
      {badge != null ? <span data-pill-badge>{badge}</span> : null}
    </Toggle>
  );
}
