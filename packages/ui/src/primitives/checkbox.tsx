import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import type { VariantProps } from "class-variance-authority";
import { Check, Minus } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";
import { checkboxVariants } from "./checkbox-variants";

export interface CheckboxProps
  extends
    ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxVariants> {}

export function Checkbox({ className, density, style, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(checkboxVariants({ density }), className)}
      style={{
        transition:
          "background var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease)",
        ...style,
      }}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-on-accent">
        {props.indeterminate ? (
          <Minus className="size-2.75" strokeWidth={3} />
        ) : (
          <Check className="size-2.75" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
