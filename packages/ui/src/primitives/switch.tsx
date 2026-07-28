import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";
import { switchVariants, thumbVariants } from "./switch-variants";

export interface SwitchProps
  extends
    ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
    VariantProps<typeof switchVariants> {}

export function Switch({ className, density, style, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(switchVariants({ density }), className)}
      style={{
        transition:
          "background var(--motion-base) var(--ease), border-color var(--motion-base) var(--ease)",
        ...style,
      }}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(thumbVariants({ density }))}
        style={{
          transition:
            "transform var(--motion-base) var(--ease), background var(--motion-base) var(--ease)",
        }}
      />
    </SwitchPrimitive.Root>
  );
}
