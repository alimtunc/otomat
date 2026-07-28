import { Input as BaseInput } from "@base-ui/react/input";
import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import { cn } from "../lib/utils";
import { inputVariants } from "./input-variants";
import { FIELD_TRANSITION } from "./styles";

export interface InputProps
  extends
    Omit<ComponentPropsWithoutRef<typeof BaseInput>, "className" | "render" | "size" | "style">,
    Pick<VariantProps<typeof inputVariants>, "density"> {
  className?: string;
  icon?: ReactNode;
  invalid?: boolean;
  style?: CSSProperties;
}

export function Input({
  className,
  density,
  icon,
  invalid,
  style,
  type = "text",
  ...props
}: InputProps) {
  const field = (
    <BaseInput
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(inputVariants({ density, hasIcon: !!icon }), className)}
      style={{ transition: FIELD_TRANSITION, ...style }}
      {...props}
    />
  );

  if (!icon) return field;

  return (
    <span className="relative flex items-center [&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:left-2.25 [&>svg]:size-3.5 [&>svg]:text-text-tertiary">
      {icon}
      {field}
    </span>
  );
}
