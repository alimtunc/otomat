import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";
import { FIELD_TRANSITION } from "./styles";
import { textareaVariants } from "./textarea-variants";

export interface TextareaProps
  extends ComponentPropsWithoutRef<"textarea">, VariantProps<typeof textareaVariants> {
  invalid?: boolean;
}

export function Textarea({ className, density, invalid, style, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(textareaVariants({ density }), className)}
      style={{ transition: FIELD_TRANSITION, ...style }}
      {...props}
    />
  );
}
