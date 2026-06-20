import { Toggle } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { ToggleGroupRoot, type ToggleGroupRootProps } from "../lib/toggle-group";
import { cn } from "../lib/utils";

const pillsVariants = cva(
  "inline-flex gap-0.5 bg-surface-1 p-0.75 rounded-md border border-border-subtle",
);

const pillVariants = cva(
  [
    "inline-flex items-center gap-1.5 px-2.5 font-medium rounded-[4px]",
    "text-text-secondary outline-none",
    "transition-[background,color] duration-[--motion-fast] ease-standard",
    "hover:text-foreground",
    "data-[pressed]:bg-surface-3 data-[pressed]:text-foreground",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:size-3.5 [&_svg]:shrink-0",
    "[&_[data-pill-badge]]:bg-transparent",
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
