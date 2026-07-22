import { Input as BaseInput } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import { cn } from "../lib/utils";
import { FIELD_TRANSITION } from "./styles";

const inputVariants = cva(
  cn(
    "w-full bg-background text-foreground border border-input rounded-md font-sans text-sm",
    "placeholder:text-text-tertiary",
    "focus:outline-none focus:border-iris-ring focus:shadow-[0_0_0_3px_var(--iris-subtle-bg)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-[0_0_0_3px_var(--danger-bg)]",
  ),
  {
    variants: {
      density: {
        compact: "h-8 px-2.5",
        comfortable: "h-9 px-3",
      },
      hasIcon: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      { density: "compact", hasIcon: true, className: "pl-7.5" },
      { density: "comfortable", hasIcon: true, className: "pl-8.5" },
    ],
    defaultVariants: { density: "compact", hasIcon: false },
  },
);

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
