import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, Minus } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";

const checkboxVariants = cva(
  cn(
    "inline-grid place-items-center shrink-0 rounded-sm border border-border-strong bg-background",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris-ring",
    "data-[checked]:bg-iris data-[checked]:border-transparent",
    "data-[indeterminate]:bg-iris data-[indeterminate]:border-transparent",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ),
  {
    variants: {
      density: {
        compact: "size-4",
        comfortable: "size-4.5",
      },
    },
    defaultVariants: { density: "compact" },
  },
);

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
