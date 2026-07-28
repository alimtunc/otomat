import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "../lib/utils";
import { badgeVariants } from "./badge-variants";

export interface BadgeProps
  extends Omit<ComponentPropsWithoutRef<"span">, "color">, VariantProps<typeof badgeVariants> {
  icon?: ReactNode;
}

export function Badge({ className, variant, icon, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props}>
      {icon}
      {children}
    </span>
  );
}
